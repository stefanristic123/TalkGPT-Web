import { AfterViewInit, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Configuration, OpenAIApi, ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from 'openai';
import * as RecordRTC from 'recordrtc';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment.development';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit {
  @ViewChildren('messages') messagescss!: QueryList<any>;
  @ViewChild('content') contentcss!: ElementRef;
  public transcribedText?: string;
  response: any;
  responseFromPreference: any
  form = new FormGroup({
    apiKeyOpenAi: new FormControl('', Validators.required),
    apiKeyElevenLabs: new FormControl('', Validators.required),
  });

  dataSource: any
  voice_id = "21m00Tcm4TlvDq8ikWAM"

  audioUrlFromEleven: any;
  record: any;
  recording = false;
  hidePreferences = true;
  url: any;
  error: any;
  loading = false;
  dataIsComming = true;
  transcriptions: any[] = [];
  dataFromLocal: any;
  showHideInputs = true;

  constructor(
    private domSanitizer: DomSanitizer,
    private http: HttpClient) {
    this.dataFromLocal = localStorage.getItem('DATA');
  }

  ngAfterViewInit() {
    this.scrollToBottom();
    this.messagescss.changes.subscribe(this.scrollToBottom);
  }

  scrollToBottom = () => {
    try {
      this.contentcss.nativeElement.scrollTop = this.contentcss.nativeElement.scrollHeight;
    } catch (err) { }
  }

  onSubmit() {
    console.log(this.form.value.apiKeyElevenLabs)
    // let systemPreference = this.form.value.text
    if (this.form.valid) {
      this.dataSource = this.form.value
      localStorage.setItem('DATA', JSON.stringify(this.dataSource));
      // let data: any = localStorage.getItem('DATA');
      // console.log(JSON.parse(data));
      this.dataFromLocal = localStorage.getItem('DATA');
      this.dataIsComming = true;
      // this.initiateRecording();
    } else {
      console.log("Please add the keys it's not that hard.")
    }

  }

  sanitize(url: string) {
    return this.domSanitizer.bypassSecurityTrustUrl(url);
  }

  initiateRecording() {
    this.recording = true;
    let mediaConstraints = { video: false, audio: true };
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

  public async processRecording(blob: any): Promise<any> {
    console.log(blob)
    this.transcript(blob);
  }

  public async transcript(audio: any): Promise<any> {
    // , systemPreference: any
    // system prefecence
    // if (systemPreference) {
    //   const completion = await this.openai.createChatCompletion({
    //     model: 'gpt-3.5-turbo',
    //     messages: [
    //       { role: ChatCompletionRequestMessageRoleEnum.System, content: systemPreference },
    //     ],
    //   });
    //   console.log(completion.data.choices[0].message);
    //   this.responseFromPreference = completion.data.choices[0].message
    // } else {
    // speach to text Whisper
    this.hidePreferences = false;
    this.dataIsComming = false;
    this.loading = true;
    let localKeys: any = localStorage.getItem('DATA')
    this.dataFromLocal = JSON.parse(localKeys);
    let api_key = this.dataFromLocal.apiKeyOpenAi;
    let configuration = new Configuration({ apiKey: api_key });
    let openai = new OpenAIApi(configuration);
    let api_key_eleven: any = this.dataFromLocal.apiKeyElevenLabs;
    this.url = URL.createObjectURL(audio);
    const formData = new FormData();
    formData.append('file', audio, 'test.wav');
    formData.append('model', 'whisper-1');

    //transkrip pitanja u tekst
    await this.http.post<any>('https://api.openai.com/v1/audio/transcriptions', formData,
      {
        headers: {
          Authorization: `Bearer ${api_key}`,
          Accept: 'application/json',
        },
      }
    ).subscribe({
      next:async res=>{

        this.transcribedText = res?.text || '';
        this.transcriptions.push({
          transcript: this.transcribedText,
          audioUrl: audio,
          role: ChatCompletionRequestMessageRoleEnum.User,
        });
    
        console.log(this.transcriptions)
        // this.loading = true;
        // Ask chat gpt and get a response
        if (!this.transcribedText) {
          console.log("My transcription faild");
          return;
        }
    
        const completion = await openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          // usage: {prompt_tokens: 56, completion_tokens: 31, total_tokens: 87},
          messages: [
            { role: ChatCompletionRequestMessageRoleEnum.User, content: this.transcribedText },
          ],
        });
    
        console.log(completion.data);
        this.response = completion.data.choices[0].message
    
        console.log(completion.data.choices[0].message?.content);
        let contentFromGPT = completion.data.choices[0].message?.content

        this.response.content = contentFromGPT;
        
        if (!contentFromGPT) {
          console.log('Response from GPT faild');
          return;
        }

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voice_id}`;
        const body = {
          text: contentFromGPT,
          voice_settings: { stability: 0, similarity_boost: 0 }
        };
    
        const responseFromEleven = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': api_key_eleven
          },
          body: JSON.stringify(body)
        });
            
        if (!responseFromEleven.ok) {
          const errorData = await responseFromEleven.json();
          if(errorData.detail.status == 'quota_exceeded')
          {
            console.log('ERORR ELEVEN>>>>>>>>>')
            //todo show some interface to 
            this.dataFromLocal = false;
            this.showHideInputs = true;
          }
          
          // throw new Error(`Text to speech conversion failed: ${errorData.detail}`);
        } else {
    
        const audioBlob = await responseFromEleven.blob();
        this.audioUrlFromEleven = URL.createObjectURL(audioBlob);
        this.response.audio = this.audioUrlFromEleven;
        console.log(this.audioUrlFromEleven)
        // this.transcriptions.pop();
        // this.transcriptions.push({
          // transcript: this.transcribedText,
          // audioUrl: audio,
          // role: ChatCompletionRequestMessageRoleEnum.User,
          // response: this.response
        // });
        this.lastFromTranscription.response = this.response;
        console.log(this.transcriptions);
    
        this.loading = false;
        this.dataIsComming = true;
        console.log(this.transcriptions)
        // }
        }
      },
      error:err=>console.log(err.message)
    })
  }

  private get lastFromTranscription(){
    return this.transcriptions[this.transcriptions.length - 1];
  }

  errorCallback(error: any) {
    this.error = 'Can not play audio in your browser';
  }
}
