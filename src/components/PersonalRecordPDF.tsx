import { forwardRef } from 'react';

export const PersonalRecordPDF = forwardRef<HTMLDivElement, { f: any }>(({ f }, ref) => {
  return (
    <div 
      ref={ref} 
      style={{ 
        width: '210mm',
        minHeight: '297mm',
        padding: '15mm',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif',
        color: 'black',
        fontSize: '11px',
        lineHeight: '1.4',
      }}
    >
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
          Tema Metropolitan Directorate of Education
        </h2>
        <h3 style={{ fontSize: '14px', fontWeight: '900', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
          Personal Record of Members of the Ghana Education Service
        </h3>
        <p style={{ margin: '0 0 15px 0', fontWeight: '900' }}>
          (TEACHING AND NON-TEACHING STAFF)
        </p>

        {/* Passport Picture Box */}
        <div style={{
          position: 'absolute',
          top: '0',
          right: '0',
          width: '35mm',
          height: '45mm',
          border: '1px solid black',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '5px'
        }}>
          {f.passportUrl ? (
            <img src={f.passportUrl} alt="Passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Affix your current<br/>Passport Size<br/><br/>Picture<br/><br/>here</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>First Name: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.firstName || f.teacherName?.split(' ')[0] || ''}</strong></div>
          <div style={{ flex: 1 }}>Other Name(s): <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.otherNames || ''}</strong></div>
          <div style={{ flex: 1 }}>Surname: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.surname || f.teacherName?.split(' ').slice(1).join(' ') || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 2 }}>Designation Dr, Rev, Mr, Mrs, Miss: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '40%' }}>{f.designation || ''}</strong></div>
          <div style={{ flex: 2 }}>Current Rank: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.currentRank || ''}</strong></div>
          <div style={{ flex: 1 }}>Sex: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.sex || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>Reg. No.: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.regNo || ''}</strong></div>
          <div style={{ flex: 1 }}>Staff ID: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.staffId || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>Date of Birth: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.dob || ''}</strong></div>
          <div style={{ flex: 1 }}>Nationality: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.nationality || ''}</strong></div>
          <div style={{ flex: 1 }}>Home Town: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.homeTown || ''}</strong></div>
        </div>
        <div>Address: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '80%' }}>{f.address || ''}</strong></div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>Mobile No.: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.phoneNumber || ''}</strong></div>
          <div style={{ flex: 1 }}>Email Address: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.emailAddress || f.email || ''}</strong></div>
          <div style={{ flex: 1 }}>SSF No.: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.ssfNo || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>NIA No.: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.niaNo || ''}</strong></div>
          <div style={{ flex: 1 }}>Driving Licence No.: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.drivingLicenceNo || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>Date of First Appointment: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.firstAppointmentDate || ''}</strong></div>
          <div style={{ flex: 1 }}>Date Confirmed: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.dateConfirmed || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 2 }}>Next of Kin: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.nextOfKin || ''}</strong></div>
          <div style={{ flex: 1 }}>Tel.: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '60%' }}>{f.nextOfKinTel || ''}</strong></div>
          <div style={{ flex: 1 }}>Relationship: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.nextOfKinRelationship || ''}</strong></div>
        </div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 2 }}>Marital Status (Whether married, single, or widow): <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '20%' }}>{f.maritalStatus || ''}</strong></div>
          <div style={{ flex: 2 }}>Name of spouse: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.spouseName || ''}</strong></div>
          <div style={{ flex: 1 }}>Tel. No: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.spouseTel || ''}</strong></div>
        </div>
        <div>
          Languages Spoken: 
          1) <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '20%' }}>{f.languages?.[0] || ''}</strong> &nbsp;
          2) <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '20%' }}>{f.languages?.[1] || ''}</strong> &nbsp;
          3) <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '20%' }}>{f.languages?.[2] || ''}</strong>
        </div>

        <div>Names and Dates of Birth of Children:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingLeft: '20px' }}>
          {[0,1,2,3,4,5].map(i => (
            <div key={i}>{i+1}) <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '80%' }}>{f.children?.[i]?.name || ''} {f.children?.[i]?.dob ? `(${f.children[i].dob})` : ''}</strong></div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Academic Qualification(s)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '4px' }}>S/N</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>LEVEL</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>SUBJECTS PASSED</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>YEAR</th>
            </tr>
          </thead>
          <tbody>
            {[0,1,2,3,4,5].map(i => (
              <tr key={i}>
                <td style={{ border: '1px solid black', padding: '4px' }}>{i+1}.</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.academic?.[i]?.level || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.academic?.[i]?.subjects || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.academic?.[i]?.year || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Professional Qualification(s)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '4px' }}>S/N</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>COURSE</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>INSTITUTION</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>FROM</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>TO</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>DATE OF AWARD<br/>OF CERTIFICATE</th>
            </tr>
          </thead>
          <tbody>
            {[0,1,2,3,4,5].map(i => (
              <tr key={i}>
                <td style={{ border: '1px solid black', padding: '4px' }}>{i+1}.</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.professional?.[i]?.course || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.professional?.[i]?.institution || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.professional?.[i]?.from || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.professional?.[i]?.to || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.professional?.[i]?.dateAwarded || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Promotion(s)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '4px' }}>KIND OF PROMOTION</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>EFFECTIVE DATE</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>SALARY SCALE</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>POINT OF ENTRY</th>
            </tr>
          </thead>
          <tbody>
            {[0,1,2,3].map(i => (
              <tr key={i}>
                <td style={{ border: '1px solid black', padding: '4px', height: '20px' }}>{f.promotions?.[i]?.kind || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.promotions?.[i]?.effectiveDate || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.promotions?.[i]?.salaryScale || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.promotions?.[i]?.pointOfEntry || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>ADDRESS OF PRESENT STATION: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '70%' }}>{f.school || ''}</strong></div>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>PRESENT SS SALARY Level: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '30%' }}>{f.presentSalaryLevel || ''}</strong> step: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '30%' }}>{f.presentSalaryStep || ''}</strong></div>
          <div style={{ flex: 1 }}>{f.category === 'SENIOR HIGH SCHOOL' ? 'DEPARTMENT FIELD' : 'SUBJECT TAUGHT'}: <strong style={{ borderBottom: '1px dotted black', display: 'inline-block', width: '50%' }}>{f.subject || ''}</strong></div>
        </div>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>Fill if name has ever been changed</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '4px' }}>FORMER NAME</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>DATE OF CHANGE</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>AUTHORITY</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: '1px solid black', padding: '4px', height: '20px' }}>{f.formerName || ''}</td>
              <td style={{ border: '1px solid black', padding: '4px' }}>{f.dateOfNameChange || ''}</td>
              <td style={{ border: '1px solid black', padding: '4px' }}>{f.nameChangeAuthority || ''}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}>
          Particulars of Employment/Posting Since Leaving School/Tertiary Institution
        </h4>
        <p style={{ margin: '0 0 5px 0', fontSize: '11px' }}>
          (Indicate where appropriate; with dates, any break or discontinuance of services e.g. study leave/maternity leave/sick leave/resignation/dismissal/suspension etc)
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid black', padding: '4px', width: '30px' }}>S/N</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>PARTICULARS OF EMPLOYMENT/POSTING</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>FROM</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>TO</th>
              <th style={{ border: '1px solid black', padding: '4px' }}>REMARKS WITH DATES</th>
            </tr>
          </thead>
          <tbody>
            {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => (
              <tr key={i}>
                <td style={{ border: '1px solid black', padding: '4px', height: '16px' }}>{i+1}.</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.employment?.[i]?.particulars || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.employment?.[i]?.from || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.employment?.[i]?.to || ''}</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>{f.employment?.[i]?.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>I certify that the information given on this form is accurate.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <div style={{ borderTop: '1px dotted black', paddingTop: '5px', width: '250px', textAlign: 'center' }}>
            SIGNATURE OF TEACHER/OFFICER
          </div>
          <div style={{ borderTop: '1px dotted black', paddingTop: '5px', width: '250px', textAlign: 'center' }}>
            SIGNATURE AND OFFICIAL STAMP OF<br/>DIRECTOR/HEAD OF SCHOOL
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          Date: <strong style={{ display: 'inline-block', minWidth: '150px', borderBottom: '1px dotted black' }}>{f.certificationDate || ''}</strong>
        </div>
      </div>
    </div>
  );
});
