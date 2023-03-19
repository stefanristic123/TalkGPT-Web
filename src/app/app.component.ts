import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Configuration, OpenAIApi, ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from 'openai';
import * as RecordRTC from 'recordrtc';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
 
  @ViewChildren('messages') messagescss!: QueryList<any>;
  @ViewChild('content') contentcss!: ElementRef;
  public transcribedText?: string;
  response: any;
  responseFromPreference: any
  form = new FormGroup({
    text: new FormControl(''),
  });

  voice_id = "21m00Tcm4TlvDq8ikWAM"
  api_key_eleven = ""
  api_key = "";
  configuration = new Configuration({apiKey: ""});
  openai = new OpenAIApi(this.configuration); 

  audioUrlFromEleven: any;
  record: any;
  recording = false;
  url: any;
  error: any;
  transcriptions: { transcript: any, role: any,audioUrl: any, response: any }[] = [];

  constructor(private domSanitizer: DomSanitizer,private http: HttpClient) {  }



ngAfterViewInit() {
  this.scrollToBottom();
  this.messagescss.changes.subscribe(this.scrollToBottom);
}

scrollToBottom = () => {
  try {
    this.contentcss.nativeElement.scrollTop = this.contentcss.nativeElement.scrollHeight;
  } catch (err) {}
}

  onSubmit(){
    console.log(this.form.value.text)
    let systemPreference = this.form.value.text
    this.transcript(null, systemPreference);
  }

  sanitize(url: string) {
    return this.domSanitizer.bypassSecurityTrustUrl(url);
  }

  initiateRecording() {
    this.recording = true;
    let mediaConstraints = { video: false, audio: true};
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(this.successCallback.bind(this), this.errorCallback.bind(this));
  }

  successCallback(stream: any) {
    var options: any = {
      mimeType: "audio/wav",
      numberOfAudioChannels: 1
    };
    var StereoAudioRecorder = RecordRTC.StereoAudioRecorder;
    this.record = new StereoAudioRecorder(stream, options);
    this.record.record();
  }

  stopRecording() {
    this.recording = false;
    this.record.stop(this.processRecording.bind(this));
  }

  public async processRecording(blob: any): Promise<any>  {
    console.log(blob)
    this.transcript(blob, null);
  }

  public async transcript(audio: any, systemPreference: any): Promise<any> { 
    // system prefecence
    if (systemPreference) {
      const completion = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: ChatCompletionRequestMessageRoleEnum.System, content: systemPreference },
        ],
      });
      console.log(completion.data.choices[0].message);
      this.responseFromPreference = completion.data.choices[0].message

    } else {
    // speach to text Whisper
    this.url = URL.createObjectURL(audio);
    console.log('Opaa', this.openai)
      const formData = new FormData();
      formData.append('file', audio, 'test.wav');
      formData.append('model', 'whisper-1');
  
      const transcriptionResponse = await this.http.post<any>('https://api.openai.com/v1/audio/transcriptions', formData,
        {
          headers: {
            Authorization: `Bearer ${this.api_key}`,
            Accept: 'application/json',
          },
        }
      ).toPromise();
  
      this.transcribedText = transcriptionResponse?.text || '';
      console.log(this.transcribedText)

      // Ask chat gpt and get a response
      if(this.transcribedText){
        const completion = await this.openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: ChatCompletionRequestMessageRoleEnum.System, content: this.transcribedText },
          ],
        });

        console.log(completion.data.choices[0].message);
        this.response = completion.data.choices[0].message

        console.log(completion.data.choices[0].message?.content);
        let contentFromGPT = completion.data.choices[0].message?.content
        if (contentFromGPT) {
          const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voice_id}`;
          const body = {
            text: contentFromGPT,
            voice_settings: { stability: 0, similarity_boost: 0 }
          };
          const responseFromEleven = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': this.api_key_eleven
            },
            body: JSON.stringify(body)
          });
          if (responseFromEleven.ok) {
            const audioBlob = await responseFromEleven.blob();
            this.audioUrlFromEleven = URL.createObjectURL(audioBlob);
            this.response.audio = this.audioUrlFromEleven;
            console.log(this.audioUrlFromEleven)

            this.transcriptions.push({ 
              transcript: this.transcribedText,
              audioUrl: audio,
              role: ChatCompletionRequestMessageRoleEnum.User,
              response: this.response
            });

            console.log(this.transcriptions)
          } else {
            const errorData = await responseFromEleven.json();
            throw new Error(`Text to speech conversion failed: ${errorData.detail[0].msg}`);
          }
        }
      }
    }  
  }

  errorCallback(error: any) {
    this.error = 'Can not play audio in your browser';
  }

}
