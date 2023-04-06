let conversationContext = '';
let recorder;
let context;

// Function to create and add the modal to the DOM
function createModal(id, str) {

  var default_text = str.split("Ours: ")[1];
  
  var modal = document.createElement("div");
  modal.id = 'modal-' + id;
  modal.className = "modal";
  
  var modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modal.appendChild(modalContent);
  
  var closeSpan = document.createElement("span");
  closeSpan.className = "close";
  closeSpan.innerHTML = "&times;";
  modalContent.appendChild(closeSpan);
  
  var heading = document.createElement("h2");
  heading.innerHTML = "Provide Feedback";
  modalContent.appendChild(heading);
  
  var feedbackDiv = document.createElement("div");
  var feedbackLabel = document.createElement("label");
  feedbackLabel.htmlFor = "feedback";
  feedbackLabel.innerHTML = "Corrected Transcript:";
  feedbackDiv.appendChild(feedbackLabel);

  var feedbackTextarea = document.createElement("textarea");
  feedbackTextarea.id = "feedback-"+id;
  feedbackTextarea.name = "feedback";
  if (default_text.length < 50){
    feedbackTextarea.cols = 50;
  }else{
    feedbackTextarea.cols = 100;
  }
  feedbackTextarea.rows = Math.ceil(default_text.length / 100);
  feedbackTextarea.value = default_text; // set default text here
  feedbackDiv.appendChild(feedbackTextarea);
  modalContent.appendChild(feedbackDiv);
  
  var keywordDiv = document.createElement("div");
  var keywordLabel = document.createElement("label");
  keywordLabel.htmlFor = "keywords";
  keywordLabel.innerHTML = "Keywords:";
  keywordDiv.appendChild(keywordLabel);
  
  var keywordInput = document.createElement("textarea");
  keywordInput.id = "keyword-" + id;
  keywordInput.name = "keyword";
  keywordInput.cols = 50;
  keywordInput.rows = 1;
  keywordDiv.appendChild(keywordInput);
  modalContent.appendChild(keywordDiv)
  
  var submitButton = document.createElement("button");
  submitButton.id = "submit-feedback-" + id;
  submitButton.innerHTML = "Submit";
  modalContent.appendChild(submitButton);
  
  text_div = document.getElementById('messages')
  text_div.appendChild(modal);
  
  // Add the event listener to the submit button
  submitButton.addEventListener("click", function() {
    var feedback = document.getElementById("feedback-" + id).value;
    var keywords = document.getElementById("keyword-" + id).value;
    // Send feedback to backend API
    fetch("api/feedback", {
      method: "POST",
      body: JSON.stringify({ id:id, feedback: feedback, keyword: keywords}),
      headers: {
        "Content-Type": "application/json"
      }
    })
    .then(response => {
      if (response.ok) {
        response.json().then(data => {
          alert("Thanks for your feedback!");
          modal.style.display = "none";
          
          // Select all the <li> elements in the document
          const listItems = document.querySelectorAll('li');
    
          // Loop through the <li> elements and remove them from the DOM
          listItems.forEach(item => item.remove());
    
          data.forEach(entity => {
            const li = document.createElement('li');
            li.innerText = entity.name;
            document.getElementById('bias-entity-list').appendChild(li);
          });
        });
      }  else {
        alert("Oops, something went wrong. Please try again later.");
      }
    })
    .catch(error => {
      console.error("Error submitting feedback:", error);
      alert("Oops, something went wrong. Please try again later.");
    });
  });

  // Add the event listener to the close button
  closeSpan.addEventListener("click", function() {
    modal.style.display = "none";
  });
}

function displayMsgDiv(str, who, id='') {
  const time = new Date();
  let hours = time.getHours();
  let minutes = time.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour "0" should be "12"
  hours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  const strTime = hours + ':' + minutes + ' ' + ampm;
  let msgHtml = "<div class='msg-card-wide mdl-card " + who + "'><div class='mdl-card__supporting-text'>";
  msgHtml += str
  if (who == 'ours'){
    msgHtml += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
    // add the code to create modal pop-up.
    //msgHtml += "<button id='feedback-button' style='display:none;'>Provide Feedback</button>"
    msgHtml += "<img src='./static/img/feedback.png' alt='Give Feedback' class='feedback-image' id='" + id + "'></img>"
  }
  msgHtml += "</div>";
  msgHtml += "<div class='" + who + "-line'>" + strTime + '</div></div>';

  $('#messages').append(msgHtml);
  $('#messages').scrollTop($('#messages')[0].scrollHeight);

  if (who == 'bot') {
    $('#q').removeAttr('disabled');
    $('#p2').fadeTo(500, 0);
  } else if(who == 'ours'){
    $('#q').val('');
    $('#q').attr('disabled', 'disabled');
    $('#p2').fadeTo(500, 1);

    createModal(id, str)

    // Open the modal when the feedback image is clicked
    document.getElementById(id).addEventListener("click", function() {
      var modal = document.getElementById('modal-' + id);
      modal.style.display = "block";
    });
  }
  else {
    $('#q').val('');
    $('#q').attr('disabled', 'disabled');
    $('#p2').fadeTo(500, 1);
  }
}

$(document).ready(function () {
  $('#q').attr('disabled', 'disabled');
  $('#p2').fadeTo(500, 1);
  $('#h').val('0');

  $.ajax({
    url: '/api/conversation',
    convText: '',
    context: '',
  })
    .done(function (res) {
      conversationContext = res.results.context;
      play(res.results.responseText);
      displayMsgDiv(res.results.responseText, 'bot');
    })
    .fail(function (jqXHR, e) {
      console.log('Error: ' + jqXHR.responseText);
    })
    .catch(function (error) {
      console.log(error);
    });

  $.ajax({
      url: '/api/entities',
  })
    .done(function (res) {
          // Loop through the data and add each item to the list
          res.forEach(entity => {
              const li = document.createElement('li');
              li.innerText = entity.name;
              document.getElementById('bias-entity-list').appendChild(li);
          });
      })
      .fail(function (jqXHR, e) {
        console.log('Error: ' + jqXHR.responseText);
      })
      .catch(function (error) {
        console.log(error);
      });

});

function addBiasEntities(){
  updateEntities(true); // the flag indicates to add new entities to existing ones.
}

function updateBiasEntities(){
  updateEntities(false); // the flag indicates to replace exisisting entities.
}

function updateEntities(flag) {
  // Get the value of the input box
  var inputText = $("#inputBox").val();

  // Make an AJAX call to the Flask API
  $.ajax({
    url: "api/update_bias_entities",
    type: "POST",
    contentType: "application/json",
    data: JSON.stringify({ input: inputText, addToExisting: flag }),
    success: function(data) {
      console.log(data);

      // Select all the <li> elements in the document
      const listItems = document.querySelectorAll('li');

      // Loop through the <li> elements and remove them from the DOM
      listItems.forEach(item => item.remove());

      data.forEach(entity => {
        const li = document.createElement('li');
        li.innerText = entity.name;
        document.getElementById('bias-entity-list').appendChild(li);
      });

    },
    error: function(error) {
      console.error(error);
    }
  });
}

function callConversation(res) {
  $('#q').attr('disabled', 'disabled');

  $.post('/api/conversation', {
    convText: res,
    context: JSON.stringify(conversationContext),
  })
    .done(function (res, status) {
      conversationContext = res.results.context;
      play(res.results.responseText);
      displayMsgDiv(res.results.responseText, 'bot');
    })
    .fail(function (jqXHR, e) {
      console.log('Error: ' + jqXHR.responseText);
    });
}

function play(inputText) {
  let buf;

  const url = '/api/text-to-speech';
  const params = 'text=' + inputText;
  const request = new XMLHttpRequest();
  request.open('POST', url, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  request.responseType = 'arraybuffer';

  // Decode asynchronously
  request.onload = function () {
    context.decodeAudioData(
      request.response,
      function (buffer) {
        buf = buffer;
        play();
      },
      function (error) {
        console.error('decodeAudioData error', error);
      }
    );
  };
  request.send(params);

  // Play the loaded file
  function play() {
    // Create a source node from the buffer
    const source = context.createBufferSource();
    source.buffer = buf;
    // Connect to the final output node (the speakers)
    source.connect(context.destination);
    // Play immediately
    source.start(0);
  }
}

const recordMic = document.getElementById('stt2');
recordMic.onclick = function () {
  const fullPath = recordMic.src;
  const filename = fullPath.replace(/^.*[\\/]/, '');
  if (filename == 'mic.gif') {
    try {
      recordMic.src = './static/img/mic_active.png';
      startRecording();
      console.log('recorder started');
      $('#q').val('I am listening ...');
    } catch (ex) {
      // console.log("Recognizer error .....");
    }
  } else {
    stopRecording();
    $('#q').val('');
    recordMic.src = './static/img/mic.gif';
  }
};

function startUserMedia(stream) {
  const input = context.createMediaStreamSource(stream);
  console.log('Media stream created.');
  // Uncomment if you want the audio to feedback directly
  // input.connect(audio_context.destination);
  // console.log('Input connected to audio context destination.');

  // eslint-disable-next-line
  recorder = new Recorder(input);
  console.log('Recorder initialised.');
}

function startRecording(button) {
  recorder && recorder.record();
  console.log('Recording...');
}

function stopRecording(button) {
  recorder && recorder.stop();
  console.log('Stopped recording.');

  recorder &&
    recorder.exportWAV(function (blob) {
      console.log(blob);
      const url = '/api/speech-to-text';
      const request = new XMLHttpRequest();
      request.open('POST', url, true);
      // request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

      // Decode asynchronously
      request.onload = function () {
        callConversation(request.response);
        json_response = JSON.parse(request.response)
        displayMsgDiv(json_response.stt, 'user');
        if (json_response.ours){
          displayMsgDiv(json_response.ours, 'ours', json_response.id);
        }
        if (json_response.whisper){
          displayMsgDiv(json_response.whisper, 'user');
        }
      };
      request.send(blob);
    });

  recorder.clear();
}

window.onload = function init() {
  try {
    // webkit shim
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    navigator.getUserMedia =  navigator.getUserMedia || navigator.webkitGetUserMedia;
    // eslint-disable-next-line
    window.URL = window.URL || window.webkitURL;

    context = new AudioContext();
    console.log('Audio context set up.');
    console.log('navigator.getUserMedia ' + (navigator.getUserMedia ? 'available.' : 'not present!'));
  } catch (e) {
    alert('No web audio support in this browser!');
  }

  navigator.getUserMedia(
    {
      audio: true,
    },
    startUserMedia,
    function (e) {
      console.log('No live audio input: ' + e);
    }
  );
};
