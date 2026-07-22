const https = require('https');
const querystring = require('querystring');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Get API key from Netlify environment variable
  const apiKey = process.env.JOTFORM_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'JOTFORM_API_KEY environment variable not set in Netlify.' })
    };
  }

  // Parse the incoming JSON body from our form
  let body = {};
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  // Map our field names to JotForm's submission[questionID] format
  // Question IDs come from the JotForm form HTML (id_4 = q4, id_5 = q5, etc.)
  const submission = {
    'submission[4]':      body.firstName      || '',
    'submission[5]':      body.lastName       || '',
    'submission[6]':      body.grade          || '',
    'submission[7]':      body.cadetEmail     || '',
    'submission[8]':      body.parentEmail    || '',
    'submission[9][full]': body.phone         || '',
    'submission[10]':     body.company        || '',
    'submission[14][]':   body.agreement      || '',
    'submission[16]':     body.semester       || '',
    'submission[28]':     body.fallActivities || 'None selected',
    'submission[29]':     body.springActivities || 'None selected',
    'submission[24]':     'Pending',
    'submission[31]':     body.signature      || '',
  };

  const postData = querystring.stringify(submission);
  const FORM_ID  = '262006514914047';

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.jotform.com',
      path: `/form/${FORM_ID}/submissions`,
      method: 'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'APIKEY':         apiKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.responseCode === 200) {
            resolve({
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
              body: JSON.stringify({
                success: true,
                submissionID: parsed.content?.submissionID || ''
              })
            });
          } else {
            resolve({
              statusCode: 400,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: parsed.message || 'JotForm rejected the submission.' })
            });
          }
        } catch (e) {
          resolve({
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Could not parse JotForm response.' })
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message })
      });
    });

    req.write(postData);
    req.end();
  });
};
