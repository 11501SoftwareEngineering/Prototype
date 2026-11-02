import { ref } from 'vue'
import { studentApi } from '@/api/student'

/**
 * 語音錄音 + 語音辨識(STT)。
 * 錄音本身在瀏覽器端做(MediaRecorder),辨識是後端做的
 * (POST /student/audio/transcribe),這裡只負責錄音、上傳、拿回文字。
 */
export function useVoiceRecorder() {
  const isRecording = ref(false)
  const isTranscribing = ref(false)
  const errorMessage = ref('')

  let mediaRecorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  // Demo（假資料）模式下沒有麥克風也能操作：假裝在錄音，停止時上傳空的音檔
  let fakeRecording = false

  async function startRecording() {
    errorMessage.value = ''
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      if (import.meta.env.VITE_USE_MOCK === 'true') {
        fakeRecording = true
        isRecording.value = true
        return
      }
      errorMessage.value = '無法使用麥克風，請確認瀏覽器已允許麥克風權限。'
      return
    }
    chunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.start()
    isRecording.value = true
  }

  async function transcribe(audioBlob: Blob) {
    isRecording.value = false
    isTranscribing.value = true
    try {
      const { text } = await studentApi.transcribeAudio(audioBlob)
      return text
    } catch (err) {
      errorMessage.value = '語音辨識失敗，請再試一次或改用文字輸入。'
      throw err
    } finally {
      isTranscribing.value = false
    }
  }

  function stopRecording(): Promise<string> {
    if (fakeRecording) {
      fakeRecording = false
      return transcribe(new Blob([], { type: 'audio/webm' }))
    }
    return new Promise((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error('尚未開始錄音'))
        return
      }

      mediaRecorder.onstop = () => {
        transcribe(new Blob(chunks, { type: 'audio/webm' })).then(resolve, reject)
      }

      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach((track) => track.stop())
    })
  }

  /** 給 UI 用的單一按鈕開關:第一次呼叫開始錄音,第二次呼叫停止並回傳轉錄文字。 */
  async function toggleRecording(): Promise<string | null> {
    if (isRecording.value) {
      return await stopRecording()
    }
    await startRecording()
    return null
  }

  return {
    isRecording,
    isTranscribing,
    errorMessage,
    startRecording,
    stopRecording,
    toggleRecording,
  }
}
