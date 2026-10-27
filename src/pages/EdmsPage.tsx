import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import EdmsModule from '../components/EdmsModule';

export default function EdmsPage() {
  const [schoolsData, setSchoolsData] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    const unsubSchools = onSnapshot(collection(db, 'schools'), snap => {
      setSchoolsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSubs = onSnapshot(collection(db, 'submissions'), snap => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubSchools();
      unsubSubs();
    };
  }, []);

  return (
    <EdmsModule
      schoolsData={schoolsData}
      submissions={submissions}
      onBackToAdmin={() => {
        window.location.href = '/admin';
      }}
    />
  );
}
