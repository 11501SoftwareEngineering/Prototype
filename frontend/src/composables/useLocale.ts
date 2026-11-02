import { ref } from 'vue'

export type Locale = 'zh-TW' | 'en' | 'es'
const supported: Locale[] = ['zh-TW', 'en', 'es']
function initialLocale(): Locale {
  try {
    const value = localStorage.getItem('socrates-ui-language') as Locale
    return supported.includes(value) ? value : 'zh-TW'
  } catch {
    return 'zh-TW'
  }
}
const locale = ref<Locale>(initialLocale())
const messages: Record<string, [string, string]> = {
  多種觀點變化: ['Different viewpoint changes', 'Distintos cambios de perspectiva'],
  觀點變化時間軸: ['Viewpoint timeline', 'Evolución de la perspectiva'],
  提問前的觀點總結: ['Summary before the question', 'Síntesis antes de la pregunta'],
  回覆後的觀點總結: ['Summary after the response', 'Síntesis después de la respuesta'],
  初步觀點總結: ['Initial viewpoint', 'Perspectiva inicial'],
  學生回覆與證據: ['Student response', 'Respuesta del estudiante'],
  查看這個提問: ['View this question', 'Ver esta pregunta'],
  查看學生回覆: ['View student response', 'Ver respuesta'],
  初步表態: ['Initial response', 'Respuesta inicial'],
  補充理由或條件: ['Added reasons or conditions', 'Razones o condiciones añadidas'],
  觀點修正: ['Viewpoint revised', 'Perspectiva revisada'],
  立場維持: ['Position maintained', 'Postura mantenida'],
  轉為不確定: ['Became uncertain', 'Pasó a la incertidumbre'],
  尚待判讀: ['Not yet assessed', 'Pendiente de interpretación'],
  觀點總結: ['Viewpoint summary', 'Síntesis de la perspectiva'],
  觀點分歧點: ['Points of disagreement', 'Puntos de desacuerdo'],
  目前立場: ['Current stance', 'Postura actual'],
  最強理由: ['Strongest reason', 'Razón principal'],
  已檢驗的挑戰: ['Challenges examined', 'Desafíos examinados'],
  修正或辯護: ['Revision or defence', 'Revisión o defensa'],
  與探究重點的連結: ['Connection to the inquiry focus', 'Conexión con el enfoque'],
  尚待追問: ['Open questions', 'Preguntas pendientes'],
  未完成或證據不足: [
    'Incomplete or insufficient evidence',
    'Información incompleta o insuficiente',
  ],
  已表達立場: ['Stance expressed', 'Postura expresada'],
  證據不足: ['Insufficient evidence', 'Evidencia insuficiente'],
  部分: ['Partial', 'Parcial'],
  對話證據: ['Conversation evidence', 'Evidencia del diálogo'],
  '搜尋匿名代碼、觀點或 tag': [
    'Search anonymous ID, viewpoint or tag',
    'Buscar código, perspectiva o etiqueta',
  ],
  '清除 tag': ['Clear tag', 'Quitar etiqueta'],
  '目前 tag': ['Current tag', 'Etiqueta actual'],
  '觀點 tag': ['Perspective tag', 'Etiqueta de perspectiva'],
  份報告: ['reports', 'informes'],
  待重新分群: ['Awaiting grouping', 'Pendiente de agrupación'],
  重新產生開場訊息: ['Regenerate opening message', 'Regenerar mensaje inicial'],
  我的課程: ['My courses', 'Mis cursos'],
  課程總覽: ['Overview', 'Vista general'],
  研究主題庫: ['Research library', 'Biblioteca de temas'],
  課程設定: ['Course setup', 'Configuración'],
  學生探究: ['Student inquiry', 'Indagación'],
  全班觀點: ['Class perspectives', 'Perspectivas de la clase'],
  對話與報告: ['Conversations & reports', 'Conversaciones e informes'],
  課程成員: ['Members', 'Miembros'],
  返回課程: ['Back to course', 'Volver al curso'],
  '課堂中的每個想法，都值得被聽見。': [
    'Every perspective deserves to be heard.',
    'Cada perspectiva merece ser escuchada.',
  ],
  教學流程: ['Learning journey', 'Proceso de aprendizaje'],
  設定探究: ['Set up an inquiry', 'Preparar una indagación'],
  進行對話: ['Explore together', 'Explorar en diálogo'],
  整理觀點: ['Discover perspectives', 'Descubrir perspectivas'],
  新增探究: ['New inquiry', 'Nueva indagación'],
  編輯設定: ['Edit setup', 'Editar configuración'],
  設定一場有深度的探究: ['Make room for deeper thinking', 'Abre espacio al pensamiento profundo'],
  '提供課程資訊，讓 AI 協助整理；每一項設定都由你決定。': [
    'Share your lesson context. Review and refine every AI suggestion.',
    'Comparte el contexto de tu clase y revisa cada sugerencia de la IA.',
  ],
  基本資訊: ['Lesson context', 'Contexto de la clase'],
  學習者年齡層: ['Learner group', 'Grupo de estudiantes'],
  '13–15 歲': ['Ages 13–15', '13–15 años'],
  '16–18 歲': ['Ages 16–18', '16–18 años'],
  大學及以上: ['University and above', 'Universidad y superior'],
  對話回合上限: ['Maximum turns', 'Máximo de turnos'],
  簡短: ['Short', 'Breve'],
  標準: ['Standard', 'Estándar'],
  較長: ['Extended', 'Extenso'],
  回合: ['turns', 'turnos'],
  內容語言: ['Content language', 'Idioma del contenido'],
  '主題／課程描述': ['Topic / lesson description', 'Tema / descripción de la clase'],
  '描述討論情境、核心問題，以及你希望學生思考的方向。': [
    'Describe the context, the question and what you want learners to explore.',
    'Describe el contexto, la pregunta y qué deseas que exploren.',
  ],
  '至少 20 字，最多 6000 字；首尾空白不計。': [
    '20–6000 characters, excluding surrounding whitespace.',
    '20–6000 caracteres, sin espacios al inicio ni al final.',
  ],
  瀏覽研究主題: ['Browse research topics', 'Explorar temas'],
  產生八欄設定: ['Prepare eight-field setup', 'Preparar configuración'],
  處理中: ['Working', 'Procesando'],
  '補充檔案功能暫不開放。請以文字描述課程。': [
    'File attachments are not available yet. Describe the lesson in text.',
    'Los archivos aún no están disponibles. Describe la clase en texto.',
  ],
  '先釐清，再開始': ['A little clarification', 'Aclaremos antes de empezar'],
  '最多三題，你也可以略過後自行編輯。': [
    'Up to three questions. You can skip them and edit the setup.',
    'Hasta tres preguntas. Puedes omitirlas y editar la configuración.',
  ],
  完成釐清: ['Continue with answers', 'Continuar con respuestas'],
  略過並整理: ['Skip and prepare', 'Omitir y preparar'],
  檢視並確認: ['Review and confirm', 'Revisar y confirmar'],
  '八個欄位都可以編輯；發布後，學生將使用相同設定與開場。': [
    'All eight fields are editable. Learners share the same published setup and opening.',
    'Los ocho campos son editables. Se comparte la configuración y apertura publicada.',
  ],
  主題: ['Topic', 'Tema'],
  核心探究問題: ['Core inquiry question', 'Pregunta central'],
  探究重點: ['Inquiry focus', 'Enfoque de indagación'],
  必要背景資訊: ['Background', 'Contexto necesario'],
  排除事項: ['Exclusions', 'Exclusiones'],
  開場訊息: ['Opening message', 'Mensaje de apertura'],
  '給 AI 的回饋／釐清回答': ['Revision feedback', 'Comentarios de revisión'],
  '告訴 AI 你希望如何調整，或直接編輯上方欄位。': [
    'Describe your changes, or edit the fields directly.',
    'Describe los cambios o edita los campos directamente.',
  ],
  依回饋重新產生: ['Refine with feedback', 'Ajustar con comentarios'],
  儲存草稿: ['Save draft', 'Guardar borrador'],
  確認並發布活動: ['Confirm & publish activity', 'Confirmar y publicar'],
  課程檢查: ['Lesson checks', 'Revisión de la clase'],
  待教師確認: ['Teacher review required', 'Requiere revisión docente'],
  已填寫: ['Completed fields', 'Campos completos'],
  教學提醒: ['Teaching notes', 'Notas docentes'],
  '每一位學生都有獨立對話脈絡。': [
    'Each learner has an independent conversation.',
    'Cada estudiante tiene una conversación independiente.',
  ],
  '開場訊息是第一回合的起點。': [
    'The opening starts the first turn.',
    'El mensaje de apertura inicia el primer turno.',
  ],
  '不預設正確立場，也不預先設定結論類別。': [
    'Explore perspectives without predefined conclusions.',
    'Explora perspectivas sin conclusiones predefinidas.',
  ],
  預覽開場: ['Opening preview', 'Vista previa de apertura'],
  模型設定: ['Model settings', 'Configuración del modelo'],
  '同一活動的學生使用相同模型。': [
    'The model is fixed for everyone in this activity.',
    'El modelo es el mismo para toda la actividad.',
  ],
  關閉: ['Close', 'Cerrar'],
  全部: ['All', 'Todos'],
  哲學: ['Philosophy', 'Filosofía'],
  倫理: ['Ethics', 'Ética'],
  法律: ['Law', 'Derecho'],
  正義: ['Justice', 'Justicia'],
  科技: ['Technology', 'Tecnología'],
  經濟: ['Economics', 'Economía'],
  搜尋主題或核心問題: ['Search topics or questions', 'Buscar temas o preguntas'],
  研究來源: ['Research sources', 'Fuentes'],
  使用此主題: ['Use topic', 'Usar tema'],
  找不到符合的主題: ['No matching topics', 'No se encontraron temas'],
  '建議設定可調整；套用時保留你選擇的年齡層與回合。': [
    'Suggested content is editable. Your learner group and turn limit stay unchanged.',
    'El contenido es editable. Se conserva el grupo y el límite de turnos.',
  ],
  '來源語言為繁體中文；其他語言須另行審閱。': [
    'Source content is Traditional Chinese. Translations require review.',
    'El contenido original está en chino tradicional. Las traducciones requieren revisión.',
  ],
  草稿: ['Draft', 'Borrador'],
  已發布: ['Published', 'Publicado'],
  進行中: ['In progress', 'En curso'],
  已完成: ['Completed', 'Completado'],
  尚未開始: ['Not started', 'Sin iniciar'],
  活動: ['Activities', 'Actividades'],
  課程代碼: ['Course code', 'Código del curso'],
  複製代碼: ['Copy code', 'Copiar código'],
  已複製: ['Copied', 'Copiado'],
  搜尋探究活動: ['Search inquiries', 'Buscar indagaciones'],
  '一個好問題，是思考的開始。': [
    'A good question is where thinking begins.',
    'Una buena pregunta inicia el pensamiento.',
  ],
  '管理課程中的探究，讓不同觀點在對話裡浮現。': [
    'Guide inquiries and make space for different perspectives.',
    'Guía indagaciones y da espacio a distintas perspectivas.',
  ],
  檢視觀點: ['View perspectives', 'Ver perspectivas'],
  繼續設定: ['Continue setup', 'Continuar configuración'],
  尚未有探究活動: ['No inquiries yet', 'Aún no hay indagaciones'],
  '等待老師發布新的探究活動。': [
    'Waiting for your teacher to publish an activity.',
    'Espera a que tu docente publique una actividad.',
  ],
  開始探究: ['Start inquiry', 'Iniciar indagación'],
  繼續探究: ['Continue inquiry', 'Continuar indagación'],
  查看個人報告: ['View my report', 'Ver mi informe'],
  '這裡沒有標準答案，試著說清楚你的理由。': [
    'There is room for your perspective. Tell us why you think so.',
    'Aquí hay espacio para tu perspectiva. Explica tus razones.',
  ],
  探究背景: ['Inquiry background', 'Contexto de indagación'],
  蘇格拉底: ['Socrates', 'Sócrates'],
  你: ['You', 'Tú'],
  你的回覆: ['Your response', 'Tu respuesta'],
  '寫下你的想法與理由…': ['Share your thoughts and reasons…', 'Comparte tus ideas y razones…'],
  送出: ['Send', 'Enviar'],
  語音輸入: ['Voice input', 'Entrada de voz'],
  略過這題: ['Skip this question', 'Omitir esta pregunta'],
  已完成回合: ['Completed turns', 'Turnos completados'],
  對話完成: ['Inquiry complete', 'Indagación completada'],
  '你的想法，值得再回顧一次。': [
    'Take another look at how your thinking developed.',
    'Revisa cómo se desarrolló tu pensamiento.',
  ],
  '本次探究已完成，個人報告會整理你的觀點、理由與轉折。': [
    'Your report brings together your viewpoint, reasons and turning points.',
    'Tu informe reúne tu perspectiva, razones y cambios.',
  ],
  '已達成本次探究目標，要在這裡收束嗎？': [
    'You have explored the inquiry goals. Ready to wrap up?',
    'Has explorado los objetivos. ¿Quieres finalizar?',
  ],
  同意結束: ['Finish inquiry', 'Finalizar indagación'],
  繼續思考: ['Keep exploring', 'Seguir explorando'],
  退出探究: ['Leave inquiry', 'Salir de la indagación'],
  個人報告: ['Individual report', 'Informe individual'],
  全班摘要: ['Class summary', 'Resumen de la clase'],
  對話紀錄: ['Transcript', 'Conversación'],
  核心觀點: ['Your perspective', 'Tu perspectiva'],
  支持理由: ['Supporting reasons', 'Razones'],
  觀點轉折: ['Turning points', 'Cambios de perspectiva'],
  尚待探究: ['Open questions', 'Preguntas abiertas'],
  其他觀點: ['Other perspectives', 'Otras perspectivas'],
  證據: ['Evidence', 'Evidencia'],
  尚未形成明確觀點: ['No clear viewpoint yet', 'Aún sin perspectiva clara'],
  報告產生中: ['Preparing your report', 'Preparando tu informe'],
  '對話已完成，報告就緒後將顯示在這裡。': [
    'Your conversation is saved. The report will appear when ready.',
    'La conversación está guardada. El informe aparecerá al estar listo.',
  ],
  老師尚未發布全班摘要: [
    'The class summary is not published yet',
    'El resumen aún no se ha publicado',
  ],
  '發布後，你可以在這裡看見不同觀點與觀點變化。': [
    'Come back after teacher review to explore the class perspectives.',
    'Vuelve después de la revisión docente para explorar las perspectivas.',
  ],
  '讓全班的想法，成為下一場討論。': [
    'Turn perspectives into the next conversation.',
    'Convierte las perspectivas en el próximo diálogo.',
  ],
  '依個人報告動態整理觀點，審閱後再分享給全班。': [
    'Discover perspectives from individual reports, then review and share.',
    'Organiza las perspectivas a partir de informes y revísalas antes de compartir.',
  ],
  產生觀點摘要: ['Generate class summary', 'Generar resumen'],
  重新整理摘要: ['Generate a new draft', 'Generar nuevo borrador'],
  學生報告: ['Student reports', 'Informes'],
  摘要審閱: ['Summary review', 'Revisión del resumen'],
  學生版預覽: ['Student preview', 'Vista del estudiante'],
  全班人數: ['Class roster', 'Estudiantes'],
  完成對話: ['Completed inquiries', 'Indagaciones completas'],
  可用報告: ['Ready reports', 'Informes disponibles'],
  觀點群組: ['Perspective groups', 'Grupos de perspectivas'],
  全班觀點分布: ['Class perspectives', 'Perspectivas de la clase'],
  未形成觀點: ['Still exploring', 'Aún explorando'],
  全班概述: ['Class overview', 'Vista general'],
  討論問題: ['Discussion questions', 'Preguntas para debatir'],
  儲存修訂: ['Save revision', 'Guardar revisión'],
  標記審閱完成: ['Mark as reviewed', 'Marcar como revisado'],
  發布給學生: ['Publish to students', 'Publicar para estudiantes'],
  撤回發布: ['Withdraw publication', 'Retirar publicación'],
  已審閱: ['Reviewed', 'Revisado'],
  尚未產生摘要: ['No summary draft yet', 'Aún no hay resumen'],
  '報告就緒後，產生一份可編輯的全班觀點摘要。': [
    'Generate an editable class summary from the ready reports.',
    'Genera un resumen editable a partir de los informes disponibles.',
  ],
  '教師審閱後，學生才能看到全班摘要。': [
    'Students see the summary only after teacher review and publication.',
    'El resumen se muestra solo después de la revisión y publicación docente.',
  ],
  '不公開個人報告、匿名代碼或其他學生的原話。': [
    'Individual reports and learner identifiers stay private.',
    'Los informes individuales y los identificadores permanecen privados.',
  ],
  閱讀報告: ['Read report', 'Leer informe'],
  搜尋匿名代碼或觀點: ['Search anonymous ID or viewpoint', 'Buscar código anónimo o perspectiva'],
  重新載入: ['Retry', 'Reintentar'],
  返回: ['Back', 'Volver'],
  儲存成功: ['Saved', 'Guardado'],
  公告: ['Announcements', 'Anuncios'],
  登入: ['Sign in', 'Iniciar sesión'],
  註冊: ['Sign up', 'Registrarse'],
  登出: ['Sign out', 'Cerrar sesión'],
  管理帳號: ['Manage accounts', 'Administrar cuentas'],
  隱私權: ['Privacy', 'Privacidad'],
  使用條款: ['Terms', 'Condiciones'],
}

export function useLocale() {
  const t = (key: string) =>
    locale.value === 'zh-TW' ? key : (messages[key]?.[locale.value === 'en' ? 0 : 1] ?? key)
  function setLocale(value: Locale) {
    locale.value = value
    document.documentElement.lang = value
    try {
      localStorage.setItem('socrates-ui-language', value)
    } catch {
      /* In-memory preference remains available. */
    }
  }
  const ageLabel = (value: string | null | undefined) =>
    t(
      value === 'university_plus' || value === '18+'
        ? '大學及以上'
        : value === '13-15'
          ? '13–15 歲'
          : value === '16-18'
            ? '16–18 歲'
            : value || '未設定',
    )
  return { locale, t, setLocale, ageLabel }
}
