# -*- coding: utf-8 -*-
# Copyright 2018 IBM Corp. All Rights Reserved.

# Licensed under the Apache License, Version 2.0 (the “License”)
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an “AS IS” BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import json
import os
from dotenv import load_dotenv
from flask import Flask, Response
from flask import jsonify
from flask import request, redirect
from flask_socketio import SocketIO
from flask_cors import CORS
from ibm_watson import AssistantV1
from ibm_watson import SpeechToTextV1
from ibm_watson import TextToSpeechV1
from ibm_cloud_sdk_core import get_authenticator_from_environment
import uuid

import requests

import assistant_setup

app = Flask(__name__)
socketio = SocketIO(app)
CORS(app)

transcribe_api_url = "http://speech.sl.cloud9.ibm.com:7000/transcribe_stream"
bias_entity_fetch_url = "http://speech.sl.cloud9.ibm.com:7000/entities"
bias_entity_update_url = "http://speech.sl.cloud9.ibm.com:7000/update_bias_entities"
feedback_api_url = "http://speech.sl.cloud9.ibm.com:7000/feedback"

# Redirect http to https on CloudFoundry
@app.before_request
def before_request():
    fwd = request.headers.get('x-forwarded-proto')

    # Not on Cloud Foundry
    if fwd is None:
        return None
    # On Cloud Foundry and is https
    elif fwd == "https":
        return None
    # On Cloud Foundry and is http, then redirect
    elif fwd == "http":
        url = request.url.replace('http://', 'https://', 1)
        code = 301
        return redirect(url, code=code)


@app.route('/')
def Welcome():
    return app.send_static_file('index.html')


@app.route('/api/conversation', methods=['POST', 'GET'])
def getConvResponse():

    '''
    #convText = request.form.get('convText')
    #convContext = request.form.get('context', "{}")

    jsonContext = json.loads(convContext)

    response = assistant.message(workspace_id=workspace_id,
                                 input={'text': convText},
                                 context=jsonContext)

    response = response.get_result()
    reponseText = response["output"]["text"]
    responseDetails = {'responseText': '... '.join(reponseText),
                       'context': response["context"]}
    '''
    
    outputString = "Please say about the following named locations!"
    #responseDetails = {'responseText': '... '.join(outputString),
    #                   'context': response["context"]}
    responseDetails = {'responseText': ''.join(outputString),
                       'context': json.loads("{}")}
    
    return jsonify(results=responseDetails)


@app.route('/api/text-to-speech', methods=['POST'])
def getSpeechFromText():
    inputText = request.form.get('text')
    ttsService = TextToSpeechV1()

    def generate():
        if inputText:
            audioOut = ttsService.synthesize(
                inputText,
                accept='audio/wav',
                voice='en-US_AllisonVoice').get_result()

            data = audioOut.content
        else:
            print("Empty response")
            data = "I have no response to that."

        yield data

    return Response(response=generate(), mimetype="audio/x-wav")

'''
#to be used for debugging the front-end.
@app.route('/api/speech-to-text', methods=['POST'])
def getTextFromSpeech():
    final_response = {}
    final_response['stt'] = "STT: hello"
    final_response['ours'] = "Ours: hello"
    final_response['whisper'] = "Whisper: hello"
    final_response['id'] = uuid.uuid4()

    return jsonify(final_response)
'''

@app.route('/api/speech-to-text', methods=['POST'])
def getTextFromSpeech():

    audio = request.get_data(cache=False)
    sttService = SpeechToTextV1()
    response = sttService.recognize(
            audio=audio,
            model='en-US_Telephony',
            content_type='audio/wav',
            timestamps=True,
            word_confidence=True,
            smart_formatting=True).get_result()

    final_response = {}
    skip_our_model = False
    # Ask user to repeat if STT can't transcribe the speech
    if len(response['results']) < 1:
        #return Response(mimetype='plain/text',
        #                response="Sorry, didn't get that. please try again!")
        stt_text_output = "There was some problem with the recording. Please try again!"
        skip_our_model = True
    else:
        text_output = response['results'][0]['alternatives'][0]['transcript']
        stt_text_output = text_output.strip()
        print(stt_text_output)
    
    final_response['stt'] = "STT: " + stt_text_output
    
    if not skip_our_model:
        headers = {
            "Content-Type": "audio/wav"
        }
        our_response = requests.post(transcribe_api_url, headers=headers, data=audio)
        print("Decoding from our Model: {}".format(our_response.json()))

        results = our_response.json()
        id = results['id']
        our_transcript = results['ours']
        final_response['ours'] = "Ours: " + our_transcript
        whisper_transcript = results['whisper']
        final_response['whisper'] = "Whisper: " + whisper_transcript
        final_response['id'] = id
    else:
        text_output = "There was some problem with the recording. Please try again!"

    #final_output = "STT Service: {}\nOur Model: {}".format(stt_text_output, text_output)

    return jsonify(final_response)

@app.route("/api/entities", methods=["GET"])
def get_entities():
    entity_response = requests.get(bias_entity_fetch_url)
    print("Biased entities from our Model: {}".format(entity_response.text))

    entity_list = entity_response.text.strip('][').split(', ')    

    entities = []
    for entity_value in entity_list:
        entity_object = {}
        entity_object["name"] = entity_value.replace("\"", "").replace("\'", "")
        entities.append(entity_object)

    # Return the data as JSON
    return jsonify(entities)

@app.route("/api/update_bias_entities", methods=["POST"])
def update_bias_entities():
    json_data = request.get_json()
    headers = {
            "Content-Type": "application/json"
    }
    entity_response = requests.post(bias_entity_update_url, headers=headers, data=json.dumps(json_data))
    print("New Biased entities from our Model: {}".format(entity_response.text))
    entity_list = entity_response.text.strip('][').split(', ') 

    entities = []
    for entity_value in entity_list:
        entity_object = {}
        entity_object["name"] = entity_value.replace("\"", "").replace("\'", "")
        entities.append(entity_object)

    # Return the data as JSON
    return jsonify(entities)

@app.route("/api/feedback", methods=["POST"])
def get_feedback():
    json_data = request.get_json()
    print(json_data)

    headers = {
            "Content-Type": "application/json"
    }
    
    feedback_response = requests.post(feedback_api_url, headers=headers, data=json.dumps(json_data))
    print("New Biased entities from our Model: {}".format(feedback_response.text))
    entity_list = feedback_response.text.strip('][').split(', ') 

    '''
    #dummy
    response = "[test_1, test_2, test_3]"
    entity_list = response.strip('][').split(', ') 
    '''

    entities = []
    for entity_value in entity_list:
        entity_object = {}
        entity_object["name"] = entity_value.replace("\"", "").replace("\'", "")
        entities.append(entity_object)

    # Return the data as JSON
    return jsonify(entities)

@app.route('/api/speech-to-text_orig', methods=['POST'])
def getTextFromSpeechOurs():

    sttService = SpeechToTextV1()

    response = sttService.recognize(
            audio=request.get_data(cache=False),
            content_type='audio/wav',
            timestamps=True,
            word_confidence=True,
            smart_formatting=True).get_result()

    # Ask user to repeat if STT can't transcribe the speech
    if len(response['results']) < 1:
        return Response(mimetype='plain/text',
                        response="Sorry, didn't get that. please try again!")

    text_output = response['results'][0]['alternatives'][0]['transcript']
    text_output = text_output.strip()
    return Response(response=text_output, mimetype='plain/text')


port = os.environ.get("PORT") or os.environ.get("VCAP_APP_PORT") or 10000
if __name__ == "__main__":
    load_dotenv()

    # SDK is currently confused. Only sees 'conversation' for CloudFoundry.
    authenticator = (get_authenticator_from_environment('assistant') or
                     get_authenticator_from_environment('conversation'))
    assistant = AssistantV1(version="2021-06-14", authenticator=authenticator)
    workspace_id = assistant_setup.init_skill(assistant)
    socketio.run(app, host='0.0.0.0', port=int(port))
