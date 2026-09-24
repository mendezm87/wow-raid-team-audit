/**
 * Google Apps Script Web App POST Endpoint
 * Receives webhook calls from the Discord Bot when raiders paste Raidbots or QE Live links.
 */
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
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Unauthorized: missing or invalid webhook secret.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const simInput = (payload && (payload.url || payload.urls || payload.report_url || payload.content || payload.text)) || '';
    if (!simInput) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No Raidbots or QE Live URL found in request body.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const result = processUniversalSimOrReport(simInput);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Google Apps Script Web App GET Endpoint (Health Check)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'WoW Raid Team Audit Sim & QE Live Webhook',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
