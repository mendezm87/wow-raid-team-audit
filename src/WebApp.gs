/**
 * Google Apps Script Web App POST Endpoint
 * Receives webhook calls from the Discord Bot when raiders paste Raidbots or QE Live links.
 */
/** JSON response for the Discord bot. Failures carry `error`, which is the field the bot displays. */
function webhookResponse_(obj) {
  const body = Object.assign({}, obj);
  if ((body.status === 'error' || body.success === false) && !body.error) {
    body.error = body.message || 'Unknown error while processing the report.';
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    let payload = null;
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter;
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    // Optional shared secret: when WEBHOOK_SECRET is set in Script Properties, only callers that send it
    // (the guild's Discord bot) can write to the sheet. Apps Script web apps can't read headers, so it's in the body.
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (expectedSecret && (!payload || payload.secret !== expectedSecret)) {
      return webhookResponse_({
        status: 'error',
        message: 'Unauthorized: missing or invalid webhook secret.'
      });
    }

    const simInput = (payload && (payload.url || payload.urls || payload.report_url || payload.content || payload.text)) || '';
    if (!simInput) {
      return webhookResponse_({
        status: 'error',
        message: 'No Raidbots or QE Live URL found in request body.'
      });
    }

    const result = processUniversalSimOrReport(simInput);
    return webhookResponse_(result || { success: false, message: 'No result returned.' });
  } catch (error) {
    return webhookResponse_({
      status: 'error',
      message: error.toString()
    });
  }
}

/**
 * Google Apps Script Web App GET Endpoint (Health Check)
 */
function doGet(e) {
  return webhookResponse_({
    status: 'online',
    service: 'WoW Raid Team Audit Sim & QE Live Webhook',
    timestamp: new Date().toISOString()
  });
}
