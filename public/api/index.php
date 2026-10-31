<?php
/**
 * Tema Metro Education Directorate (GES) - cPanel MySQL REST API
 * Subdomain: https://temametro.codecasticgh.com/api/index.php
 */

require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? $_POST['action'] ?? 'health';
$collection = $_GET['collection'] ?? $_POST['collection'] ?? '';

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function upsert_record(PDO $pdo, string $col, array $doc): string {
    $id = isset($doc['id']) && trim((string)$doc['id']) !== ''
        ? trim((string)$doc['id'])
        : uniqid($col . '_', true);
    $doc['id'] = $id;
    $json = json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($col === 'users') {
        $stmt = $pdo->prepare("
            INSERT INTO `users` (`id`, `email`, `role`, `staffId`, `isOnline`, `lastActive`, `data_json`)
            VALUES (:id, :email, :role, :staffId, :isOnline, :lastActive, :data_json)
            ON DUPLICATE KEY UPDATE
              `email` = VALUES(`email`),
              `role` = VALUES(`role`),
              `staffId` = VALUES(`staffId`),
              `isOnline` = VALUES(`isOnline`),
              `lastActive` = VALUES(`lastActive`),
              `data_json` = VALUES(`data_json`)
        ");
        $stmt->execute([
            ':id'         => $id,
            ':email'      => $doc['email'] ?? null,
            ':role'       => $doc['role'] ?? 'teacher',
            ':staffId'    => $doc['staffId'] ?? null,
            ':isOnline'   => !empty($doc['isOnline']) ? 1 : 0,
            ':lastActive' => $doc['lastActive'] ?? null,
            ':data_json'  => $json,
        ]);
    } elseif ($col === 'submissions') {
        $stmt = $pdo->prepare("
            INSERT INTO `submissions` (
              `id`, `staffId`, `teacherName`, `email`, `category`, `circuit`, `school`,
              `currentRank`, `status`, `submittedBy`, `photoUrl`, `data_json`
            ) VALUES (
              :id, :staffId, :teacherName, :email, :category, :circuit, :school,
              :currentRank, :status, :submittedBy, :photoUrl, :data_json
            )
            ON DUPLICATE KEY UPDATE
              `staffId` = VALUES(`staffId`),
              `teacherName` = VALUES(`teacherName`),
              `email` = VALUES(`email`),
              `category` = VALUES(`category`),
              `circuit` = VALUES(`circuit`),
              `school` = VALUES(`school`),
              `currentRank` = VALUES(`currentRank`),
              `status` = VALUES(`status`),
              `submittedBy` = VALUES(`submittedBy`),
              `photoUrl` = VALUES(`photoUrl`),
              `data_json` = VALUES(`data_json`)
        ");
        $stmt->execute([
            ':id'          => $id,
            ':staffId'     => $doc['staffId'] ?? null,
            ':teacherName' => $doc['teacherName'] ?? trim(($doc['firstName'] ?? '') . ' ' . ($doc['surname'] ?? '')),
            ':email'       => $doc['email'] ?? null,
            ':category'    => $doc['category'] ?? null,
            ':circuit'     => $doc['circuit'] ?? null,
            ':school'      => $doc['school'] ?? null,
            ':currentRank' => $doc['currentRank'] ?? null,
            ':status'      => $doc['status'] ?? 'submitted',
            ':submittedBy' => $doc['submittedBy'] ?? null,
            ':photoUrl'    => $doc['photoUrl'] ?? null,
            ':data_json'   => $json,
        ]);
    } elseif ($col === 'schools') {
        $stmt = $pdo->prepare("
            INSERT INTO `schools` (`id`, `emis`, `name`, `circuit`, `type`, `levels`, `head`, `data_json`)
            VALUES (:id, :emis, :name, :circuit, :type, :levels, :head, :data_json)
            ON DUPLICATE KEY UPDATE
              `emis` = VALUES(`emis`),
              `name` = VALUES(`name`),
              `circuit` = VALUES(`circuit`),
              `type` = VALUES(`type`),
              `levels` = VALUES(`levels`),
              `head` = VALUES(`head`),
              `data_json` = VALUES(`data_json`)
        ");
        $stmt->execute([
            ':id'        => $id,
            ':emis'      => $doc['emis'] ?? $doc['code'] ?? null,
            ':name'      => $doc['name'] ?? $doc['school'] ?? null,
            ':circuit'   => $doc['circuit'] ?? null,
            ':type'      => $doc['type'] ?? $doc['ownership'] ?? 'PUBLIC',
            ':levels'    => $doc['levels'] ?? null,
            ':head'      => $doc['head'] ?? null,
            ':data_json' => $json,
        ]);
    } else {
        throw new InvalidArgumentException('Invalid collection: ' . $col);
    }

    return $id;
}

try {
    $pdo = get_db_connection();

    if ($action === 'health') {
        $counts = [
            'users'       => (int)$pdo->query("SELECT COUNT(*) FROM `users`")->fetchColumn(),
            'submissions' => (int)$pdo->query("SELECT COUNT(*) FROM `submissions`")->fetchColumn(),
            'schools'     => (int)$pdo->query("SELECT COUNT(*) FROM `schools`")->fetchColumn(),
        ];
        echo json_encode([
            'ok'       => true,
            'database' => DB_NAME,
            'counts'   => $counts,
            'server'   => $_SERVER['HTTP_HOST'] ?? 'localhost',
        ]);
        exit;
    }

    if ($action === 'list') {
        if (!in_array($collection, ['users', 'submissions', 'schools'], true)) {
            throw new InvalidArgumentException('Invalid collection name');
        }
        $stmt = $pdo->query("SELECT `id`, `data_json`, `updated_at` FROM `{$collection}` ORDER BY `updated_at` DESC");
        $items = [];
        while ($row = $stmt->fetch()) {
            $decoded = json_decode($row['data_json'], true);
            if (is_array($decoded)) {
                $decoded['id'] = $row['id'];
                $items[] = $decoded;
            }
        }
        echo json_encode(['ok' => true, 'items' => $items]);
        exit;
    }

    if ($action === 'upsert') {
        if (!in_array($collection, ['users', 'submissions', 'schools'], true)) {
            throw new InvalidArgumentException('Invalid collection name');
        }
        $body = read_json_body();
        $pdo->beginTransaction();

        if (isset($body['items']) && is_array($body['items'])) {
            $savedIds = [];
            foreach ($body['items'] as $item) {
                if (is_array($item)) {
                    $savedIds[] = upsert_record($pdo, $collection, $item);
                }
            }
            $pdo->commit();
            echo json_encode(['ok' => true, 'count' => count($savedIds), 'ids' => $savedIds]);
            exit;
        } else {
            $doc = $body['doc'] ?? $body;
            $savedId = upsert_record($pdo, $collection, $doc);
            $pdo->commit();
            echo json_encode(['ok' => true, 'id' => $savedId]);
            exit;
        }
    }

    if ($action === 'delete') {
        if (!in_array($collection, ['users', 'submissions', 'schools'], true)) {
            throw new InvalidArgumentException('Invalid collection name');
        }
        $body = read_json_body();
        $id = $body['id'] ?? $_GET['id'] ?? '';
        if (!$id) {
            throw new InvalidArgumentException('Missing id to delete');
        }
        $stmt = $pdo->prepare("DELETE FROM `{$collection}` WHERE `id` = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode(['ok' => true, 'deletedId' => $id]);
        exit;
    }

    echo json_encode(['ok' => false, 'error' => 'Unknown action: ' . $action]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => $e->getMessage(),
    ]);
}
