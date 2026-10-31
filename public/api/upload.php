<?php
/**
 * Tema Metro Education Directorate (GES) - cPanel Local File Storage & Mirror Endpoint
 * Subdomain: https://temametro.codecasticgh.com/api/upload.php
 *
 * Stores uploaded teacher PDFs and Passport Photos inside /uploads/ on your cPanel server.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function sanitize_segment(string $seg): string {
    $clean = preg_replace('/[^a-zA-Z0-9_\-\. ]/', '_', trim($seg));
    $clean = preg_replace('/_+/', '_', $clean);
    return $clean ?: 'general';
}

$baseUploadsDir = dirname(__DIR__) . '/uploads';
if (!is_dir($baseUploadsDir)) {
    @mkdir($baseUploadsDir, 0755, true);
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'temametro.codecasticgh.com';
$baseUrl = $scheme . '://' . $host . '/uploads';

$action = $_GET['action'] ?? $_POST['action'] ?? 'upload';

try {
    // 1. Mirror a remote Cloudinary URL directly into cPanel /uploads/
    if ($action === 'mirror_url') {
        $raw = file_get_contents('php://input');
        $body = $raw ? json_decode($raw, true) : $_POST;
        $sourceUrl = trim((string)($body['url'] ?? ''));
        $folder    = trim((string)($body['folder'] ?? 'mirrored'));
        $fileName  = trim((string)($body['fileName'] ?? basename(parse_url($sourceUrl, PHP_URL_PATH) ?: 'file.pdf')));

        if (!$sourceUrl || !preg_match('/^https?:\/\//i', $sourceUrl)) {
            throw new RuntimeException('Invalid source URL');
        }

        $segments = array_filter(explode('/', str_replace('\\', '/', $folder)));
        $safeFolder = implode('/', array_map('sanitize_segment', $segments));
        $targetDir = $baseUploadsDir . ($safeFolder ? '/' . $safeFolder : '');
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        $safeFile = sanitize_segment($fileName);
        $targetPath = $targetDir . '/' . $safeFile;

        if (!file_exists($targetPath)) {
            $ctx = stream_context_create([
                'http' => ['timeout' => 30, 'follow_location' => 1],
                'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
            ]);
            $bytes = @file_get_contents($sourceUrl, false, $ctx);
            if ($bytes === false) {
                throw new RuntimeException('Could not download remote file: ' . $sourceUrl);
            }
            file_put_contents($targetPath, $bytes);
        }

        $publicUrl = $baseUrl . ($safeFolder ? '/' . rawurlencode($safeFolder) : '') . '/' . rawurlencode($safeFile);
        $publicUrl = str_replace('%2F', '/', $publicUrl);

        echo json_encode([
            'ok'         => true,
            'secure_url' => $publicUrl,
            'fileName'   => $safeFile,
        ]);
        exit;
    }

    // 2. Direct Multipart File Upload from TeacherForm
    if (!isset($_FILES['file'])) {
        throw new RuntimeException('No file uploaded');
    }

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Upload error code: ' . $file['error']);
    }

    $folder = $_POST['folder'] ?? 'ges-tema/uploads';
    $segments = array_filter(explode('/', str_replace('\\', '/', $folder)));
    $safeFolder = implode('/', array_map('sanitize_segment', $segments));
    $targetDir = $baseUploadsDir . ($safeFolder ? '/' . $safeFolder : '');

    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }

    $origName = $file['name'] ?: 'document.pdf';
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($ext, $allowed, true)) {
        $ext = 'pdf';
    }

    $baseName = sanitize_segment(pathinfo($origName, PATHINFO_FILENAME));
    $finalName = $baseName . '.' . $ext;
    $targetPath = $targetDir . '/' . $finalName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new RuntimeException('Failed to move uploaded file on server');
    }

    $publicUrl = $baseUrl . ($safeFolder ? '/' . str_replace('%2F', '/', rawurlencode($safeFolder)) : '') . '/' . rawurlencode($finalName);

    echo json_encode([
        'ok'         => true,
        'secure_url' => $publicUrl,
        'fileName'   => $finalName,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => $e->getMessage(),
    ]);
}
