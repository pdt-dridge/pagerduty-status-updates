/** SET YOUR OWN ENVIROMENTAL VARIABLES 

 - either through the editor UI: File > Project Properties > Script Properties
 - or programatically as per below
 
// PagerDuty Credentials
   PropertiesService.getScriptProperties().setProperty('apiToken', 'xxxxxxxxxxxxx');
   PropertiesService.getScriptProperties().setProperty('userID', 'xxxxxx@pagerduty.com');

// Google Form ID
   PropertiesService.getScriptProperties().setProperty('formID', 'xxxxxxxxxxxxxxxxxxxxxxxxxxx');

**/

function sendStatusUpdate() {
    
  /* REPLACE THESE WITH YOUR OWN (if you want) */
  
  // Email Template Placeholders
  var emailSubject = 'Incident Status Update';
  const companyLogo = '<img src="https://i.imgur.com/t9O1AuH.png" alt="company logo" width="284" height="126"/>';
  const timeStampLocale = 'en-AU';
  
  // Retrieve the form ID from Script Properties
  const formID = PropertiesService.getScriptProperties().getProperty('formID');
  
  //get the last response/submission
  var form = FormApp.openById(formID);
  var formResponses = form.getResponses();
  var formResponse = formResponses[formResponses.length-1];
  
  // get the list of answers from that submission
  var itemResponses = formResponse.getItemResponses();
  
  // isolate the individual answers
  var incidentID = itemResponses[0].getResponse();
  var statusUpdate = itemResponses[1].getResponse();
  var isCustomHTML = itemResponses[2];
  
  
  //PagerDuty Status Update API Endpoint
  var incidentURL = 'https://api.pagerduty.com/incidents/' + incidentID;
  var statusUpdatesURL = incidentURL + '/status_updates';
  var requestPayload = '';
  
  
  if(isCustomHTML) {
    
    Logger.log("Fancy HTML Selected");
    Logger.log("Getting Incident Details for: ", incidentID); 

    // Get Incident Details
    var incidentDetails = getPDInfo(incidentURL);
    
    if(incidentDetails.incidentExists){
      
      // Get the Incident Title for the email
      var response = incidentDetails.response;
	  var incidentSummary = JSON.parse(response.getContentText()).incident.summary;
      
      // update email suject with Incident Details
      emailSubject = incidentSummary + ' - Status Update';
	  
      Logger.log("Getting previous updates for incident: ", incidentID); 
    
      // Get the Previous Status Updates
      var response = getPDInfo(statusUpdatesURL).response;
      var previousUpdates = JSON.parse(response.getContentText()).status_updates;
      
      Logger.log('Number of Previous Updates = ', previousUpdates.length);
      
      if (previousUpdates.length > 0){
        
        // format the previous updates html
        var htmlPreviousUpdates = constructPreviousUpdates(previousUpdates, timeStampLocale);
      } 
      else {
        // no previous updates
        var htmlPreviousUpdates = '';
      }
      
      // construct the Custom HTML email
      var htmlEmail = constructHTMLEmail(companyLogo, incidentSummary, statusUpdate, htmlPreviousUpdates);
            
      var requestPayload = JSON.stringify({ 
                        content_type : 'text/html',
                        message: statusUpdate,
                        subject: emailSubject,
                        html_message : htmlEmail
                        }); 
      
      Logger.log("Fancy HTML Payload: ",  requestPayload);
    }
    else {
      Logger.log("Error retieving incident details, no update made ");
    }
  }
  
  // Use Default PagerDuty Message Format
  else {
    
    Logger.log("Plain Text Selected");
    
    var requestPayload = JSON.stringify({ 
      message: statusUpdate
    }); 
    
    Logger.log("Plain Text Payload: ", requestPayload);
  }
  
  Logger.log("Sending Update to PagerDuty incident: ", incidentID); 
  
  var userID = PropertiesService.getScriptProperties().getProperty('userID');
  var apiToken = 'Token token=' + PropertiesService.getScriptProperties().getProperty('apiToken');
  
  // Update the Incident via the REST API 
  try {
    var response = UrlFetchApp.fetch(
      statusUpdatesURL,
      {
        'method': 'POST',
        'payload': requestPayload,
        'headers': {
          'Content-Type': 'application/json',
          'From': userID,
          'Authorization': apiToken 
        }
      }
    )
    Logger.log('POST Return code: ' + response.getResponseCode());
    } catch (err) {
      Logger.log('Error: ' + response.getResponseCode());
    }
    
}


function getPDInfo(url) {
  
  var userID = PropertiesService.getScriptProperties().getProperty('userID');
  var apiToken = 'Token token=' + PropertiesService.getScriptProperties().getProperty('apiToken');
  var incidentExists = true;
  
  try {
    var response = UrlFetchApp.fetch(
      url,
      {
        'method': 'GET',
        'payload': '',
        'headers': {
          'Content-Type': 'application/json',
          'From': userID,
          'Authorization': apiToken
        }
      }
    ); 
  } catch (err) {
    incidentExists = false;
    Logger.log('Error retieving incident: response: ' + response);
  }
  
  var variables = { response: response, incidentExists: incidentExists};
  
  return variables;
  
}


function constructHTMLEmail(companyLogo, incidentSummary, statusUpdate, htmlPreviousUpdates) {
  
  // There's probably a way to import HTML from an actual email template here
  
  Logger.log('constructing HTML email');
  
  var htmlEmailTop = '<table width="70%"> <tbody> <tr> <td>' + companyLogo + '</td> </tr> '+
                     '<tr> <td> <h2><span style="color: #000080;">' + incidentSummary + '</span></h2> </td> </tr>' +                    
                     '<tr> <td> <h3><span style="color: #000080;">Status Update:</span></h3> </td> </tr>';
  
  var htmlStatusUpdate = '<tr><td>' + statusUpdate + '</td></tr></tbody></table>';
  
  var htmlEmail = htmlEmailTop + 
                  htmlStatusUpdate + 
                  htmlPreviousUpdates;
  
  return htmlEmail;
  
}

function constructPreviousUpdates(previousUpdates, timeStampLocale) {
  
  Logger.log('constructing Previous Updates');
  
  // set up HTML for Previous Updates section of the email
  var htmlPreviousUpdatesTitle = '<h4>Previous Updates:</h4> <table width="70%"> <tbody>';
  var htmlPreviousUpdate = '';
  var htmlPreviousUpdatesEnd = '</tbody></table>';
  
  // make the timezone info look pretty
  const options = {timeZoneName: 'short'};
  
  // loop through the previous updates
  for (var i = 0; i < previousUpdates.length; i++) {
    
    var prevUpdate = previousUpdates[i];
    var prevUpdateMessage = prevUpdate.message;
    var prevTimeStamp = new Date(prevUpdate.created_at).toLocaleString(timeStampLocale, options);
    
    // add a previous update row to the table
    htmlPreviousUpdate += '<tr><td>' + prevUpdateMessage + '</td></tr>' +
                          '<tr><td><span style="color: #808080;">' + prevTimeStamp + '</span></td></tr>' +
                          '<tr><td>-----------------------------------</td></tr>';
  }
  
  var htmlPreviousUpdates = htmlPreviousUpdatesTitle +
                            htmlPreviousUpdate +
                            htmlPreviousUpdatesEnd;
  
  return htmlPreviousUpdates;
  
}