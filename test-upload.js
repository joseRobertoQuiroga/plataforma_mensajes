const http = require('http');
const fs = require('fs');

// 1. Create campaign
const campBody = JSON.stringify({name:'Test Upload CSV',channel:'whatsapp'});
const campReq = http.request('http://localhost:3100/api/campaigns', {method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(campBody)}}, (res) => {
  let data='';
  res.on('data', c => data+=c);
  res.on('end', () => {
    const camp = JSON.parse(data);
    console.log('Campaign created:', camp.id, camp.name);
    console.log();

    // 2. Upload CSV
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const filePath = 'C:/proyectos/plataforma_mensajes/test_leads.csv';
    const content = fs.readFileSync(filePath);
    const header = '--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="test_leads.csv"\r\nContent-Type: text/csv\r\n\r\n';
    const footer = '\r\n--' + boundary + '--\r\n';
    const body = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      content,
      Buffer.from(footer, 'utf-8')
    ]);

    const upReq = http.request('http://localhost:3100/api/campaigns/' + camp.id + '/leads/upload', {
      method:'POST',
      headers:{
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length
      }
    }, (res2) => {
      let data2='';
      res2.on('data', c => data2+=c);
      res2.on('end', () => {
        try {
          const result = JSON.parse(data2);
          console.log('Upload result:');
          console.log('  total_rows:', result.total_rows);
          console.log('  created:', result.created);
          console.log('  errors:', result.errors);
          console.log('  duplicates:', result.duplicates);
          console.log('  column_mapping:', JSON.stringify(result.column_mapping));
          console.log();
          if (result.leads && result.leads.length > 0) {
            console.log('  First 3 leads:');
            result.leads.slice(0,3).forEach(l => console.log('    -', l.name || '(no name)', '/', l.phone || '(no phone)', '/', l.email || '(no email)'));
          }
          if (result.error_details && result.error_details.length > 0) {
            console.log('  Errors:');
            result.error_details.forEach(e => console.log('    row', e.row, ':', e.reason));
          }
        } catch(e) {
          console.log('Parse error:', data2.substring(0,500));
        }
      });
    });
    upReq.write(body);
    upReq.end();
  });
});
campReq.write(campBody);
campReq.end();
