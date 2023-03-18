import { Component } from '@angular/core';
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
export class AppComponent {
 
  public transcribedText?: string;
  response: any;
  form = new FormGroup({
    text: new FormControl(''),
  });

  api_key = "";
  configuration = new Configuration({apiKey: ""});
  openai = new OpenAIApi(this.configuration); 

  record: any;
  recording = false;
  url: any;
  error: any;
  transcriptions: { transcript: any, role: any,audioUrl: any, response: any }[] = [];


  constructor(private domSanitizer: DomSanitizer,private http: HttpClient) {  }


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
    this.transcript(blob);
  }

  // public async transcript(audio: any): Promise<any> { 

  //   this.url = URL.createObjectURL(audio);
  //   console.log('akalala', this.openai)
  //     const formData = new FormData();
  //     formData.append('file', audio, 'test.wav');
  //     formData.append('model', 'whisper-1');
  //     // formData.append('language', 'en');
  
  //     const transcriptionResponse = await this.http.post<any>(
  //       'https://api.openai.com/v1/audio/transcriptions',
  //       formData,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${this.api_key}`,
  //           Accept: 'application/json',
  //         },
  //       }
  //     ).toPromise();
  
  //     this.transcribedText = transcriptionResponse?.text || '';
  //     console.log(this.transcribedText)

  //     if(this.transcribedText){
  //       this.onSubmit(this.transcribedText)
  //       this.transcriptions.push({ transcript: this.transcribedText, audioUrl: audio });
  //     }
  // }

  // public async onSubmit(data: any): Promise<any> { 
  //   // let data: string = this.form.value.text!;
  //   const completion = await this.openai.createChatCompletion({
  //     model: 'gpt-3.5-turbo',
  //     messages: [
  //       { role: ChatCompletionRequestMessageRoleEnum.System, content: data },
  //     ],
  //   });

  //   console.log(completion.data.choices[0].message);

  //   this.response = completion.data.choices[0].message
  //   return this.response;
  // }


  public async transcript(audio: any): Promise<any> { 
    this.url = URL.createObjectURL(audio);
    console.log('akalala', this.openai)
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

      if(this.transcribedText){
        const completion = await this.openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: ChatCompletionRequestMessageRoleEnum.System, content: this.transcribedText },
          ],
        });

        console.log(completion.data.choices[0].message);

        this.response = completion.data.choices[0].message

        this.transcriptions.push({ 
          transcript: this.transcribedText,
          audioUrl: audio,
          role: ChatCompletionRequestMessageRoleEnum.User,
          response: this.response
        });
      }
  }

  errorCallback(error: any) {
    this.error = 'Can not play audio in your browser';
  }

}
