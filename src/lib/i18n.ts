// UI translation. English is the source and the fallback for any missing key. Flat dotted keys ("nav.week") for one lookup; no React or query imports, so the server (alert email, schema enum) can import this without pulling client code into the server bundle.

export const LANGUAGE_IDS = ["en", "es", "fr", "it", "ja"] as const;
export type Lang = (typeof LANGUAGE_IDS)[number];

// `label` is the English name, always shown as-is, so "Language" and its option names stay English. `locale` is the BCP47 tag threaded into the date formatters.
export const LANGUAGES: { id: Lang; label: string; locale: string }[] = [
  { id: "en", label: "English", locale: "en-GB" },
  { id: "es", label: "Español", locale: "es" },
  { id: "fr", label: "Français", locale: "fr" },
  { id: "it", label: "Italiano", locale: "it" },
  { id: "ja", label: "日本語", locale: "ja-JP" },
];

export function isLang(value: string): value is Lang {
  return (LANGUAGE_IDS as readonly string[]).includes(value);
}

export function localeFor(lang: Lang): string {
  return LANGUAGES.find((l) => l.id === lang)?.locale ?? "en-GB";
}

type Translations = Partial<Record<Lang, string>>;

export const DICTIONARY: Record<string, Translations> = {
  "nav.week": { en: "Timetable", es: "Horario", fr: "Planning", it: "Orario", ja: "タイムテーブル" },
  "nav.backlog": { en: "Backlog", es: "Tareas", fr: "Tâches", it: "Attività", ja: "バックログ" },
  "nav.dashboard": { en: "Metrics", es: "Métricas", fr: "Métriques", it: "Metriche", ja: "メトリクス" },
  "nav.settings": { en: "Settings", es: "Ajustes", fr: "Réglages", it: "Impostazioni", ja: "設定" },

  "timer.idle": {
    en: "No timer running. Press play to start one.",
    es: "No hay temporizador activo. Pulsa play para iniciar uno.",
    fr: "Aucun minuteur en cours. Appuyez sur lecture pour en démarrer un.",
    it: "Nessun timer attivo. Premi play per avviarne uno.",
    ja: "タイマーは停止中です。再生ボタンで開始してください。",
  },
  "timer.stop": { en: "Stop timer", es: "Detener temporizador", fr: "Arrêter le minuteur", it: "Ferma timer", ja: "タイマーを停止" },
  "timer.start": { en: "Start timer", es: "Iniciar temporizador", fr: "Démarrer le minuteur", it: "Avvia timer", ja: "タイマーを開始" },
  "timer.placeholder": {
    en: "What are you working on?",
    es: "¿En qué estás trabajando?",
    fr: "Sur quoi travaillez-vous ?",
    it: "A cosa stai lavorando?",
    ja: "何に取り組んでいますか？",
  },
  "timer.starttime": { en: "Start time", es: "Hora de inicio", fr: "Heure de début", it: "Ora di inizio", ja: "開始時刻" },
  "alert.stale.title": {
    en: "No alert check has run in over 24 hours. The GitHub Actions schedule may be disabled.",
    es: "No se ha ejecutado ninguna comprobación de alertas en más de 24 horas. Es posible que la programación de GitHub Actions esté desactivada.",
    fr: "Aucune vérification d'alerte depuis plus de 24 heures. La planification GitHub Actions est peut-être désactivée.",
    it: "Nessun controllo avvisi da oltre 24 ore. La pianificazione GitHub Actions potrebbe essere disattivata.",
    ja: "24時間以上アラート確認が実行されていません。GitHub Actions のスケジュールが無効になっている可能性があります。",
  },
  "alert.stale.badge": {
    en: "Alert check stale",
    es: "Comprobación de alertas atrasada",
    fr: "Vérification d'alerte en retard",
    it: "Controllo avvisi in ritardo",
    ja: "アラート確認が遅延",
  },

  "week.prev": { en: "Previous week", es: "Semana anterior", fr: "Semaine précédente", it: "Settimana precedente", ja: "前の週" },
  "week.next": { en: "Next week", es: "Semana siguiente", fr: "Semaine suivante", it: "Settimana successiva", ja: "次の週" },
  "week.today": { en: "Today", es: "Hoy", fr: "Aujourd'hui", it: "Oggi", ja: "今日" },
  "week.weekPrefix": { en: "W", es: "S", fr: "S", it: "S", ja: "第" },
  "week.weekSuffix": { en: "", es: "", fr: "", it: "", ja: "週" },
  "week.tracked": {
    en: "{n} tracked",
    es: "{n} registrado",
    fr: "{n} suivi",
    it: "{n} registrato",
    ja: "記録 {n}",
  },
  "week.fit": { en: "Fit to viewport", es: "Ajustar a la ventana", fr: "Ajuster à la fenêtre", it: "Adatta alla finestra", ja: "画面に合わせる" },
  "week.zoom": { en: "Grid zoom", es: "Zoom de la cuadrícula", fr: "Zoom de la grille", it: "Zoom della griglia", ja: "グリッドのズーム" },
  "week.pxPerHour": { en: "{n}", es: "{n}", fr: "{n}", it: "{n}", ja: "{n}" },
  "week.hint": {
    en: "Double-click to start the timer there (snaps to 15 minutes) · drag for an exact range · a double-click on an earlier day logs a {block}-minute block · hold Alt while dragging for minute precision · Ctrl+scroll to zoom",
    es: "Doble clic para iniciar el temporizador ahí (ajusta a 15 minutos) · arrastra para un intervalo exacto · un doble clic en un día anterior registra un bloque de {block} minutos · mantén Alt al arrastrar para precisión de minuto · Ctrl+rueda para hacer zoom",
    fr: "Double-clic pour démarrer le minuteur à cet endroit (snap au quart d'heure) · glissez pour une plage exacte · un double-clic sur un jour antérieur crée un bloc de {block} minutes · maintenez Alt en glissant pour une précision à la minute · Ctrl+défilement pour zoomer",
    it: "Doppio clic per avviare il timer lì (snap a 15 minuti) · trascina per un intervallo esatto · un doppio clic su un giorno precedente registra un blocco di {block} minuti · tieni Alt durante il trascinamento per la precisione al minuto · Ctrl+scroll per zoomare",
    ja: "ダブルクリックでそこからタイマーを開始（15分単位にスナップ） · ドラッグで正確な範囲を指定 · 過去の日をダブルクリックすると {block} 分のブロックを記録 · ドラッグ中に Alt で分単位の精度 · Ctrl+スクロールでズーム",
  },

  "entry.delete": { en: "Delete entry", es: "Eliminar entrada", fr: "Supprimer l'entrée", it: "Elimina voce", ja: "エントリーを削除" },
  "entry.project": { en: "Project", es: "Proyecto", fr: "Projet", it: "Progetto", ja: "プロジェクト" },
  "entry.start": { en: "Start", es: "Inicio", fr: "Début", it: "Inizio", ja: "開始" },
  "entry.end": { en: "End", es: "Fin", fr: "Fin", it: "Fine", ja: "終了" },
  "entry.tags": { en: "Tags", es: "Etiquetas", fr: "Étiquettes", it: "Etichette", ja: "タグ" },
  "entry.running": { en: "running", es: "en marcha", fr: "en cours", it: "in corso", ja: "実行中" },
  "entry.stopNow": { en: "Stop now", es: "Detener ahora", fr: "Arrêter maintenant", it: "Ferma ora", ja: "今すぐ停止" },
  "entry.tagsPlaceholder": { en: "comma, separated", es: "coma, separadas", fr: "virgule, séparées", it: "virgola, separate", ja: "カンマ区切り" },
  "entry.cancel": { en: "Cancel", es: "Cancelar", fr: "Annuler", it: "Annulla", ja: "キャンセル" },
  "entry.save": { en: "Save", es: "Guardar", fr: "Enregistrer", it: "Salva", ja: "保存" },
  "entry.endDayOffset": { en: "{n}d", es: "{n}d", fr: "{n}j", it: "{n}g", ja: "{n}日" },

  "taskstrip.due": { en: "{n} due", es: "{n} pendiente", fr: "{n} à faire", it: "{n} da fare", ja: "残り {n}" },
  "taskstrip.done": { en: "{n} done", es: "{n} hechas", fr: "{n} faites", it: "{n} fatte", ja: "完了 {n}" },
  "taskstrip.changeProject": {
    en: "{name} ({project}). Click to change project.",
    es: "{name} ({project}). Clic para cambiar de proyecto.",
    fr: "{name} ({project}). Cliquez pour changer de projet.",
    it: "{name} ({project}). Clic per cambiare progetto.",
    ja: "{name}（{project}）。クリックでプロジェクトを変更。",
  },
  "taskstrip.start": { en: "Start {name}", es: "Iniciar {name}", fr: "Démarrer {name}", it: "Avvia {name}", ja: "{name} を開始" },

  "project.frequent": { en: "Frequent", es: "Frecuentes", fr: "Fréquents", it: "Frequenti", ja: "よく使う" },
  "project.all": { en: "All projects", es: "Todos los proyectos", fr: "Tous les projets", it: "Tutti i progetti", ja: "すべてのプロジェクト" },
  "project.namePlaceholder": { en: "Project name", es: "Nombre del proyecto", fr: "Nom du projet", it: "Nome progetto", ja: "プロジェクト名" },
  "project.add": { en: "Add", es: "Añadir", fr: "Ajouter", it: "Aggiungi", ja: "追加" },
  "project.newProject": { en: "New project", es: "Proyecto nuevo", fr: "Nouveau projet", it: "Nuovo progetto", ja: "新規プロジェクト" },
  "common.others": { en: "Others", es: "Otros", fr: "Autres", it: "Altri", ja: "その他" },
  "common.entry.one": { en: "{n} entry", es: "{n} entrada", fr: "{n} entrée", it: "{n} voce", ja: "{n}件のエントリー" },
  "common.entry.other": { en: "{n} entries", es: "{n} entradas", fr: "{n} entrées", it: "{n} voci", ja: "{n}件のエントリー" },
  "common.task.one": { en: "{n} task", es: "{n} tarea", fr: "{n} tâche", it: "{n} attività", ja: "{n}件のタスク" },
  "common.task.other": { en: "{n} tasks", es: "{n} tareas", fr: "{n} tâches", it: "{n} attività", ja: "{n}件のタスク" },
  "toast.movedToOthers": {
    en: "Moved {entries} and {tasks} to Others",
    es: "Se movieron {entries} y {tasks} a Otros",
    fr: "{entries} et {tasks} déplacées vers Autres",
    it: "Spostate {entries} e {tasks} in Altri",
    ja: "{entries}と{tasks}を「その他」に移動しました",
  },

  "dial.aria": { en: "Time range dial", es: "Selector de intervalo", fr: "Cadran de plage", it: "Selettore intervallo", ja: "時間範囲ダイヤル" },
  "dial.start": { en: "Start time", es: "Hora de inicio", fr: "Heure de début", it: "Ora di inizio", ja: "開始時刻" },
  "dial.end": { en: "End time", es: "Hora de fin", fr: "Heure de fin", it: "Ora di fine", ja: "終了時刻" },
  "dial.am": { en: "AM", es: "AM", fr: "AM", it: "AM", ja: "午前" },
  "dial.pm": { en: "PM", es: "PM", fr: "PM", it: "PM", ja: "午後" },
  "dial.handleLabel": {
    en: "{label}, {handle} time",
    es: "{label}, hora de {handle}",
    fr: "{label}, heure de {handle}",
    it: "{label}, ora di {handle}",
    ja: "{label}、{handle}の時刻",
  },
  "dial.handleStart": { en: "start", es: "inicio", fr: "début", it: "inizio", ja: "開始" },
  "dial.handleEnd": { en: "end", es: "fin", fr: "fin", it: "fine", ja: "終了" },
  "dial.hint": {
    en: "Drag the handles · AM/PM moves the {handle} · hold Alt for 1-minute steps",
    es: "Arrastra las manijas · AM/PM mueve el {handle} · mantén Alt para pasos de 1 minuto",
    fr: "Glissez les poignées · AM/PM déplace le {handle} · maintenez Alt pour des pas de 1 minute",
    it: "Trascina le maniglie · AM/PM sposta il {handle} · tieni Alt per passi di 1 minuto",
    ja: "ハンドルをドラッグ · AM/PM で{handle}を移動 · Alt で1分単位",
  },

  "color.change": { en: "Change colour", es: "Cambiar color", fr: "Changer la couleur", it: "Cambia colore", ja: "色を変更" },
  "color.changeProject": { en: "Change project colour", es: "Cambiar color del proyecto", fr: "Changer la couleur du projet", it: "Cambia colore progetto", ja: "プロジェクトの色を変更" },
  "color.custom": { en: "Custom colour", es: "Color personalizado", fr: "Couleur personnalisée", it: "Colore personalizzato", ja: "カスタム色" },
  "color.use": { en: "Use {swatch}", es: "Usar {swatch}", fr: "Utiliser {swatch}", it: "Usa {swatch}", ja: "{swatch} を使用" },

  "confirm.confirm": { en: "Confirm", es: "Confirmar", fr: "Confirmer", it: "Conferma", ja: "確認" },
  "confirm.cancel": { en: "Cancel", es: "Cancelar", fr: "Annuler", it: "Annulla", ja: "キャンセル" },

  "dash.heading": { en: "Metrics", es: "Métricas", fr: "Métriques", it: "Metriche", ja: "メトリクス" },
  "dash.range.week": { en: "This week", es: "Esta semana", fr: "Cette semaine", it: "Questa settimana", ja: "今週" },
  "dash.range.month": { en: "4 weeks", es: "4 semanas", fr: "4 semaines", it: "4 settimane", ja: "4週間" },
  "dash.range.quarter": { en: "13 weeks", es: "13 semanas", fr: "13 semaines", it: "13 settimane", ja: "13週間" },
  "dash.range.year": { en: "52 weeks", es: "52 semanas", fr: "52 semaines", it: "52 settimane", ja: "52週間" },
  "dash.footer": {
    en: "A running timer counts up to now, so today's numbers move as you work. Entries that cross midnight are split at the local day boundary, so each day gets its real share of the minutes.",
    es: "Un temporizador en marcha cuenta hasta ahora, por lo que los números de hoy cambian mientras trabajas. Las entradas que cruzan medianoche se dividen en el límite del día local, de modo que cada día recibe su parte real de los minutos.",
    fr: "Un minuteur en cours compte jusqu'à maintenant, donc les chiffres du jour évoluent pendant que vous travaillez. Les entrées qui traversent minuit sont coupées à la limite du jour local, pour que chaque jour reçoive sa part réelle des minutes.",
    it: "Un timer in corso conta fino a ora, quindi i numeri di oggi cambiano mentre lavori. Le voci che attraversano mezzanotte sono divise al limite del giorno locale, così ogni giorno riceve la sua parte reale di minuti.",
    ja: "実行中のタイマーは現在までカウントされるため、今日の数値は作業中に変化します。真夜夜をまたぐエントリーはローカル日の境界で分割され、それぞれの日が実際の分数を正しく受け取ります。",
  },

  "summary.total": { en: "Total tracked", es: "Total registrado", fr: "Total suivi", it: "Totale registrato", ja: "合計記録" },
  "summary.avg": { en: "Average per active day", es: "Media por día activo", fr: "Moyenne par jour actif", it: "Media per giorno attivo", ja: "活動日あたりの平均" },
  "summary.longest": { en: "Longest day", es: "Día más largo", fr: "Journée la plus longue", it: "Giorno più lungo", ja: "最長の日" },
  "summary.topProject": { en: "Most tracked project", es: "Proyecto más registrado", fr: "Projet le plus suivi", it: "Progetto più registrato", ja: "最も記録の多いプロジェクト" },
  "summary.avgHint.one": { en: "{n} day with time", es: "{n} día con tiempo", fr: "{n} jour avec du temps", it: "{n} giorno con tempo", ja: "{n}日に時間あり" },
  "summary.avgHint.other": { en: "{n} days with time", es: "{n} días con tiempo", fr: "{n} jours avec du temps", it: "{n} giorni con tempo", ja: "{n}日に時間あり" },
  "summary.goal.one": {
    en: "Against a {goal}h/day goal over {weeks} week of weekdays, that is {vsGoal}h.",
    es: "Frente a un objetivo de {goal}h/día durante {weeks} semana de días laborables, son {vsGoal}h.",
    fr: "Sur un objectif de {goal}h/jour sur {weeks} semaine de jours ouvrés, c'est {vsGoal}h.",
    it: "Rispetto a un obiettivo di {goal}h/giorno su {weeks} settimana di giorni feriali, è {vsGoal}h.",
    ja: "平日{weeks}週の{goal}時間/日の目標に対し、{vsGoal}時間です。",
  },
  "summary.goal.other": {
    en: "Against a {goal}h/day goal over {weeks} weeks of weekdays, that is {vsGoal}h.",
    es: "Frente a un objetivo de {goal}h/día durante {weeks} semanas de días laborables, son {vsGoal}h.",
    fr: "Sur un objectif de {goal}h/jour sur {weeks} semaines de jours ouvrés, c'est {vsGoal}h.",
    it: "Rispetto a un obiettivo di {goal}h/giorno su {weeks} settimane di giorni feriali, è {vsGoal}h.",
    ja: "平日{weeks}週の{goal}時間/日の目標に対し、{vsGoal}時間です。",
  },

  "donut.title": { en: "Time by project", es: "Tiempo por proyecto", fr: "Temps par projet", it: "Tempo per progetto", ja: "プロジェクト別時間" },
  "donut.empty.title": { en: "No time tracked in this range", es: "Sin tiempo registrado en este rango", fr: "Aucun temps suivi dans cette plage", it: "Nessun tempo registrato in questo range", ja: "この期間に記録された時間はありません" },
  "donut.empty.body": { en: "Nothing to show yet", es: "Nada que mostrar todavía", fr: "Rien à afficher pour l'instant", it: "Niente da mostrare ancora", ja: "表示できるものはまだありません" },
  "donut.subtitle": { en: "{n} total", es: "{n} total", fr: "{n} au total", it: "{n} totale", ja: "合計 {n}" },
  "donut.other": { en: "Other ({n})", es: "Otros ({n})", fr: "Autres ({n})", it: "Altri ({n})", ja: "その他 ({n})" },
  "donut.col.project": { en: "Project", es: "Proyecto", fr: "Projet", it: "Progetto", ja: "プロジェクト" },
  "donut.col.tracked": { en: "Tracked", es: "Registrado", fr: "Suivi", it: "Registrato", ja: "記録" },
  "donut.col.share": { en: "Share", es: "Cuota", fr: "Part", it: "Quota", ja: "割合" },

  "chart.perDay.title": { en: "Hours per day", es: "Horas por día", fr: "Heures par jour", it: "Ore al giorno", ja: "1日あたりの時間" },
  "chart.perDay.subtitle": { en: "Goal {goal}h · dashed line", es: "Objetivo {goal}h · línea discontinua", fr: "Objectif {goal}h · ligne en pointillés", it: "Obiettivo {goal}h · linea tratteggiata", ja: "目標 {goal}h · 破線" },
  "chart.perDay.col.day": { en: "Day", es: "Día", fr: "Jour", it: "Giorno", ja: "日" },
  "chart.perDay.col.tracked": { en: "Tracked", es: "Registrado", fr: "Suivi", it: "Registrato", ja: "記録" },
  "chart.perDay.col.vsgoal": { en: "vs goal", es: "vs objetivo", fr: "vs objectif", it: "vs obiettivo", ja: "目標比" },

  "chart.perWeek.title": { en: "Hours per week", es: "Horas por semana", fr: "Heures par semaine", it: "Ore a settimana", ja: "週あたりの時間" },
  "chart.perWeek.subtitle": {
    en: "Last {weeks} weeks · goal {goal}h/week",
    es: "Últimas {weeks} semanas · objetivo {goal}h/semana",
    fr: "Dernières {weeks} semaines · objectif {goal}h/semaine",
    it: "Ultime {weeks} settimane · obiettivo {goal}h/settimana",
    ja: "直近{weeks}週 · 目標 {goal}h/週",
  },
  "chart.perWeek.weeks": { en: "Weeks", es: "Semanas", fr: "Semaines", it: "Settimane", ja: "週" },
  "chart.perWeek.col.week": { en: "Week", es: "Semana", fr: "Semaine", it: "Settimana", ja: "週" },
  "chart.perWeek.col.tracked": { en: "Tracked", es: "Registrado", fr: "Suivi", it: "Registrato", ja: "記録" },
  "chart.perWeek.col.avg": { en: "{n}-week avg", es: "Media de {n} semanas", fr: "Moyenne sur {n} semaines", it: "Media di {n} settimane", ja: "{n}週平均" },
  "chart.perWeek.series.tracked": { en: "Tracked", es: "Registrado", fr: "Suivi", it: "Registrato", ja: "記録" },
  "chart.perWeek.series.avg": { en: "{n}-week average", es: "Media de {n} semanas", fr: "Moyenne sur {n} semaines", it: "Media di {n} settimane", ja: "{n}週平均" },

  "panel.showNumbers": { en: "Show the numbers", es: "Mostrar los números", fr: "Afficher les chiffres", it: "Mostra i numeri", ja: "数値を表示" },

  "settings.heading": { en: "Settings", es: "Ajustes", fr: "Réglages", it: "Impostazioni", ja: "設定" },
  "settings.timezone.title": { en: "Home time zone", es: "Zona horaria principal", fr: "Fuseau horaire de référence", it: "Fuso orario principale", ja: "基準タイムゾーン" },
  "settings.timezone.copy": {
    en: "The week grid always renders in this zone, wherever you are. A 9am block stays a 9am block, and weekly totals never shift when you travel.",
    es: "La cuadrícula semanal siempre se dibuja en esta zona, estés donde estés. Un bloque a las 9am sigue siendo un bloque a las 9am, y los totales semanales no cambian al viajar.",
    fr: "La grille de la semaine s'affiche toujours dans ce fuseau, où que vous soyez. Un bloc de 9h reste un bloc de 9h, et les totaux hebdomadaires ne bougent pas quand vous voyagez.",
    it: "La griglia della settimana viene sempre renderizzata in questo fuso, ovunque tu sia. Un blocco delle 9:00 resta alle 9:00, e i totali settimanali non cambiano quando viaggi.",
    ja: "週グリッドは常にこのタイムゾーンで描画されます。9時のブロックはどこにいても9時のままで、移動しても週の合計はずれません。",
  },
  "settings.alerts.row": { en: "Runaway-timer alerts", es: "Alertas de temporizador desbocado", fr: "Alertes de minuteur emballé", it: "Avvisi timer fuori controllo", ja: "タイマー暴走アラート" },
  "settings.alerts.rowHint": {
    en: "Email me once when a timer runs past the threshold below.",
    es: "Avísame por correo cuando un temporizador supere el umbral de abajo.",
    fr: "Envoyez-moi un email quand un minuteur dépasse le seuil ci-dessous.",
    it: "Avvisami via email quando un timer supera la soglia qui sotto.",
    ja: "タイマーが下のしきい値を超えたら1回メールで知らせます。",
  },
  "settings.alerts.title": { en: "Runaway timer alert", es: "Alerta de temporizador desbocado", fr: "Alerte de minuteur emballé", it: "Avviso timer fuori controllo", ja: "タイマー暴走アラート" },
  "settings.alerts.copy": {
    en: "Nothing truncates a timer. A GitHub Actions schedule pings the app every 15 minutes; if an entry has been running past the threshold above, you get one email, one per entry, ever, so a timer left running over a weekend does not send hundreds. The timer keeps running until you stop it.",
    es: "Nada corta un temporizador. Una programación de GitHub Actions consulta la app cada 15 minutos; si una entrada lleva funcionando más del umbral anterior, recibes un correo, uno por entrada y para siempre, de modo que un temporizador olvidado el fin de semana no envía cientos. El temporizador sigue hasta que lo detienes.",
    fr: "Rien n'interrompt un minuteur. Une planification GitHub Actions interroge l'app toutes les 15 minutes ; si une entrée tourne au-delà du seuil ci-dessus, vous recevez un email, un seul par entrée et pour toujours, afin qu'un minuteur oublié le week-end n'en envoie pas des centaines. Le minuteur continue jusqu'à ce que vous l'arrêtiez.",
    it: "Niente interrompe un timer. Una pianificazione GitHub Actions controlla l'app ogni 15 minuti; se una voce è in corso oltre la soglia sopra, ricevi un'email, una sola per voce e per sempre, così un timer lasciato acceso nel weekend non ne invia centinaia. Il timer continua finché non lo fermi.",
    ja: "タイマーを強制終了することはありません。GitHub Actions が15分ごとにアプリを確認し、上のしきい値を超えて動いているエントリーがあれば、エントリー1件につき1通限りのメールを送ります。週末に放置されたタイマーが何百通も送ることはありません。タイマーは停止するまで動き続けます。",
  },
  "settings.field.timezone": { en: "Time zone", es: "Zona horaria", fr: "Fuseau horaire", it: "Fuso orario", ja: "タイムゾーン" },
  "settings.field.dailyGoal": { en: "Daily goal (hours)", es: "Objetivo diario (horas)", fr: "Objectif quotidien (heures)", it: "Obiettivo giornaliero (ore)", ja: "1日の目標（時間）" },
  "settings.field.weeks": { en: "Weeks in the weekly chart", es: "Semanas en el gráfico semanal", fr: "Semaines dans le graphique hebdomadaire", it: "Settimane nel grafico settimanale", ja: "週次グラフの週数" },
  "settings.field.alertAfter": {
    en: "Email me if a timer runs past (hours)",
    es: "Avísame si un temporizador pasa de (horas)",
    fr: "M'avertir si un minuteur dépasse (heures)",
    it: "Avvisami se un timer supera (ore)",
    ja: "タイマーが次を超えたら通知（時間）",
  },
  "settings.save": { en: "Save", es: "Guardar", fr: "Enregistrer", it: "Salva", ja: "保存" },
  "settings.lastCheck": { en: "Last alert check: ", es: "Última comprobación de alertas: ", fr: "Dernière vérification d'alerte : ", it: "Ultimo controllo avvisi: ", ja: "最終アラート確認: " },
  "settings.never": {
    en: "never. The scheduled workflow has not run yet.",
    es: "nunca. El flujo programado aún no se ha ejecutado.",
    fr: "jamais. Le workflow planifié n'a pas encore tourné.",
    it: "mai. Il workflow pianificato non è ancora stato eseguito.",
    ja: "未実行。スケジュールされたワークフローはまだ実行されていません。",
  },
  "about.title": { en: "About", es: "Acerca de", fr: "À propos", it: "Informazioni", ja: "概要" },
  "about.version": { en: "Cadence, version {version} (build {build})", es: "Cadence, versión {version} (compilación {build})", fr: "Cadence, version {version} (build {build})", it: "Cadence, versione {version} (build {build})", ja: "Cadence、バージョン {version}（ビルド {build}）" },
  "about.commit": { en: "{commit}", es: "{commit}", fr: "{commit}", it: "{commit}", ja: "{commit}" },
  "about.built": { en: ", built {date}", es: ", compilado el {date}", fr: ", compilé le {date}", it: ", compilato il {date}", ja: "、ビルド {date}" },
  "about.noCommit": { en: "no commit recorded", es: "sin commit registrado", fr: "aucun commit enregistré", it: "nessun commit registrato", ja: "コミット記録なし" },

  "settings.language": { en: "Language", es: "Language", fr: "Language", it: "Language", ja: "Language" },

  "projects.title": { en: "Projects", es: "Proyectos", fr: "Projets", it: "Progetti", ja: "プロジェクト" },
  "projects.copy": {
    en: "Archiving hides a project from the pickers but keeps its history. Deleting moves its entries and tasks to Others. Time data is never destroyed.",
    es: "Archivar oculta un proyecto de los selectores pero mantiene su historial. Eliminar mueve sus entradas y tareas a Otros. Los datos de tiempo nunca se destruyen.",
    fr: "Archiver masque un projet des sélecteurs mais en garde l'historique. Supprimer déplace ses entrées et tâches vers Autres. Les données de temps ne sont jamais détruites.",
    it: "Archiviare nasconde un progetto dai selettori ma ne conserva lo storico. Eliminare sposta le voci e le attività in Altri. I dati di tempo non vengono mai distrutti.",
    ja: "アーカイブするとプロジェクトが選択画面で非表示になりますが、履歴は残ります。削除するとエントリーとタスクは「その他」に移動します。時間データは絶対に失われません。",
  },
  "projects.namePlaceholder": { en: "New project name", es: "Nombre del proyecto nuevo", fr: "Nom du nouveau projet", it: "Nome del nuovo progetto", ja: "新規プロジェクト名" },
  "projects.add": { en: "Add", es: "Añadir", fr: "Ajouter", it: "Aggiungi", ja: "追加" },
  "projects.systemDefault": { en: "system default", es: "predeterminado del sistema", fr: "défaut du système", it: "predefinito del sistema", ja: "システム既定" },
  "projects.archived": { en: "archived", es: "archivado", fr: "archivé", it: "archiviato", ja: "アーカイブ済み" },
  "projects.unarchive": { en: "Unarchive", es: "Desarchivar", fr: "Désarchiver", it: "Disarchivia", ja: "アーカイブ解除" },
  "projects.archive": { en: "Archive", es: "Archivar", fr: "Archiver", it: "Archivia", ja: "アーカイブ" },
  "projects.delete": { en: "Delete project", es: "Eliminar proyecto", fr: "Supprimer le projet", it: "Elimina progetto", ja: "プロジェクトを削除" },
  "projects.deleteTitle": { en: "Delete \"{name}\"?", es: "¿Eliminar \"{name}\"?", fr: "Supprimer « {name} » ?", it: "Eliminare \"{name}\"?", ja: "「{name}」を削除しますか？" },
  "projects.deleteBody.one": {
    en: "{entries} time entry and {tasks} task will move to Others. No time is lost.",
    es: "{entries} entrada de tiempo y {tasks} tarea se moverán a Otros. No se pierde tiempo.",
    fr: "{entries} entrée de temps et {tasks} tâche seront déplacées vers Autres. Aucun temps n'est perdu.",
    it: "{entries} voce di tempo e {tasks} attività saranno spostate in Altri. Nessun tempo perso.",
    ja: "{entries}件の時間エントリーと{tasks}件のタスクが「その他」に移動します。時間は失われません。",
  },
  "projects.deleteBody.other": {
    en: "{entries} time entries and {tasks} tasks will move to Others. No time is lost.",
    es: "{entries} entradas de tiempo y {tasks} tareas se moverán a Otros. No se pierde tiempo.",
    fr: "{entries} entrées de temps et {tasks} tâches seront déplacées vers Autres. Aucun temps n'est perdu.",
    it: "{entries} voci di tempo e {tasks} attività saranno spostate in Altri. Nessun tempo perso.",
    ja: "{entries}件の時間エントリーと{tasks}件のタスクが「その他」に移動します。時間は失われません。",
  },
  "projects.cancel": { en: "Cancel", es: "Cancelar", fr: "Annuler", it: "Annulla", ja: "キャンセル" },
  "projects.deleteReassign": { en: "Delete and reassign", es: "Eliminar y reasignar", fr: "Supprimer et réaffecter", it: "Elimina e riassegna", ja: "削除して再割り当て" },

  "theme.title": { en: "Theme", es: "Tema", fr: "Thème", it: "Tema", ja: "テーマ" },
  "theme.copy": {
    en: "System follows your OS; the rest force a palette. Picked here, applied at once.",
    es: "Sistema sigue tu SO; el resto impone una paleta. Elegido aquí, aplicado al instante.",
    fr: "Système suit votre OS ; les autres imposent une palette. Choisi ici, appliqué aussitôt.",
    it: "Sistema segue il SO; gli altri impongono una palette. Scelto qui, applicato subito.",
    ja: "システムはOSに従い、それ以外はパレットを強制します。ここで選ぶと即座に適用されます。",
  },
  "theme.light": { en: "Light", es: "Claro", fr: "Clair", it: "Chiaro", ja: "ライト" },
  "theme.dark": { en: "Dark", es: "Oscuro", fr: "Sombre", it: "Scuro", ja: "ダーク" },
  "theme.system": { en: "System", es: "Sistema", fr: "Système", it: "Sistema", ja: "システム" },
  "theme.daylight": { en: "Daylight", es: "Luz de día", fr: "Lumière du jour", it: "Luce diurna", ja: "デイライト" },
  "theme.paper": { en: "Paper", es: "Papel", fr: "Papier", it: "Carta", ja: "ペーパー" },
  "theme.midnight": { en: "Midnight", es: "Medianoche", fr: "Minuit", it: "Mezzanotte", ja: "ミッドナイト" },
  "theme.slate": { en: "Slate", es: "Pizarra", fr: "Ardoise", it: "Ardesia", ja: "スレート" },
  "theme.terminal": { en: "Terminal", es: "Terminal", fr: "Terminal", it: "Terminale", ja: "ターミナル" },

  "page.week": { en: "Timetable", es: "Horario", fr: "Planning", it: "Orario", ja: "タイムテーブル" },
  "page.backlog": { en: "Backlog", es: "Tareas", fr: "Tâches", it: "Attività", ja: "バックログ" },
  "page.dashboard": { en: "Metrics", es: "Métricas", fr: "Métriques", it: "Metriche", ja: "メトリクス" },
  "page.settings": { en: "Settings", es: "Ajustes", fr: "Réglages", it: "Impostazioni", ja: "設定" },
  "page.signin": { en: "Sign in", es: "Iniciar sesión", fr: "Connexion", it: "Accedi", ja: "サインイン" },

  "login.heading": { en: "Cadence", es: "Cadence", fr: "Cadence", it: "Cadence", ja: "Cadence" },
  "login.subtitle": {
    en: "This instance is private. Sign in with your email and password.",
    es: "Esta instancia es privada. Inicia sesión con tu correo y contraseña.",
    fr: "Cette instance est privée. Connectez-vous avec votre email et mot de passe.",
    it: "Questa istanza è privata. Accedi con email e password.",
    ja: "このインスタンスはプライベートです。メールとパスワードでサインインしてください。",
  },
  "login.email": { en: "Email", es: "Correo", fr: "Email", it: "Email", ja: "メール" },
  "login.password": { en: "Password", es: "Contraseña", fr: "Mot de passe", it: "Password", ja: "パスワード" },
  "login.signin": { en: "Sign in", es: "Iniciar sesión", fr: "Se connecter", it: "Accedi", ja: "サインイン" },
  "login.signingIn": { en: "Signing in…", es: "Iniciando sesión…", fr: "Connexion…", it: "Accesso…", ja: "サインイン中…" },
  "login.error.invalid": {
    en: "Invalid email or password.",
    es: "Correo o contraseña no válidos.",
    fr: "Email ou mot de passe invalide.",
    it: "Email o password non valide.",
    ja: "メールまたはパスワードが正しくありません。",
  },

  "toast.somethingWrong": { en: "Something went wrong", es: "Algo salió mal", fr: "Une erreur s'est produite", it: "Qualcosa è andato storto", ja: "問題が発生しました" },
  "toast.entryDeleted": { en: "Entry deleted", es: "Entrada eliminada", fr: "Entrée supprimée", it: "Voce eliminata", ja: "エントリーを削除しました" },
  "toast.undo": { en: "Undo", es: "Deshacer", fr: "Annuler", it: "Annulla", ja: "元に戻す" },
  "toast.settingsSaved": { en: "Settings saved", es: "Ajustes guardados", fr: "Réglages enregistrés", it: "Impostazioni salvate", ja: "設定を保存しました" },

  "error.title": { en: "Could not load", es: "No se pudo cargar", fr: "Chargement impossible", it: "Caricamento non riuscito", ja: "読み込めませんでした" },
  "error.hint": {
    en: "The server did not answer. It may be down, or the database may be unreachable.",
    es: "El servidor no respondió. Puede estar caído o la base de datos no estar accesible.",
    fr: "Le serveur n'a pas répondu. Il est peut-être arrêté ou la base de données inaccessible.",
    it: "Il server non ha risposto. Potrebbe essere spento o il database irraggiungibile.",
    ja: "サーバーが応答しませんでした。サーバーが停止しているか、データベースに接続できない可能性があります。",
  },
  "error.retry": { en: "Try again", es: "Reintentar", fr: "Réessayer", it: "Riprova", ja: "再試行" },

  "export.title": { en: "Export", es: "Exportar", fr: "Exporter", it: "Esporta", ja: "エクスポート" },
  "export.hint": {
    en: "Downloads the completed entries in this range as a CSV. A running timer is left out until you stop it.",
    es: "Descarga en CSV las entradas completadas de este rango. Un temporizador en marcha queda fuera hasta que lo detienes.",
    fr: "Télécharge les entrées terminées de cette plage en CSV. Un minuteur en cours est exclu tant que vous ne l'arrêtez pas.",
    it: "Scarica in CSV le voci completate di questo intervallo. Un timer in corso resta fuori finché non lo fermi.",
    ja: "この期間の完了したエントリーをCSVでダウンロードします。実行中のタイマーは停止するまで含まれません。",
  },
  "export.from": { en: "From", es: "Desde", fr: "De", it: "Da", ja: "開始" },
  "export.to": { en: "To", es: "Hasta", fr: "À", it: "A", ja: "終了" },
  "export.download": { en: "Download CSV", es: "Descargar CSV", fr: "Télécharger CSV", it: "Scarica CSV", ja: "CSVをダウンロード" },

  "backlog.heading": { en: "Backlog", es: "Tareas", fr: "Tâches", it: "Attività", ja: "バックログ" },
  "backlog.placeholder": { en: "What needs doing?", es: "¿Qué hay que hacer?", fr: "Que faut-il faire ?", it: "Cosa da fare?", ja: "何をしますか？" },
  "backlog.section.work": { en: "Work-related tasks", es: "Tareas de trabajo", fr: "Tâches liées au travail", it: "Attività di lavoro", ja: "作業関連タスク" },
  "backlog.section.study": { en: "Study tasks", es: "Tareas de estudio", fr: "Tâches d'étude", it: "Attività di studio", ja: "学習タスク" },
  "backlog.sectionShort.work": { en: "Work", es: "Trabajo", fr: "Travail", it: "Lavoro", ja: "作業" },
  "backlog.sectionShort.study": { en: "Study", es: "Estudio", fr: "Étude", it: "Studio", ja: "学習" },
  "backlog.sectionAria": { en: "Section", es: "Sección", fr: "Section", it: "Sezione", ja: "セクション" },
  "backlog.projectAria": { en: "Project", es: "Proyecto", fr: "Projet", it: "Progetto", ja: "プロジェクト" },
  "backlog.addDesc": { en: "Add a description", es: "Añadir una descripción", fr: "Ajouter une description", it: "Aggiungi una descrizione", ja: "説明を追加" },
  "backlog.add": { en: "Add", es: "Añadir", fr: "Ajouter", it: "Aggiungi", ja: "追加" },
  "backlog.notesPlaceholder": { en: "Description (optional)", es: "Descripción (opcional)", fr: "Description (facultatif)", it: "Descrizione (opzionale)", ja: "説明（任意）" },
  "backlog.empty.title": { en: "The backlog is empty", es: "La lista de tareas está vacía", fr: "La liste des tâches est vide", it: "La lista è vuota", ja: "バックログは空です" },
  "backlog.empty.hint": {
    en: "Add a task above. Starting one opens a timer linked to it, so the dashboard can show real time spent.",
    es: "Añade una tarea arriba. Iniciar una abre un temporizador vinculado a ella, para que el panel muestre el tiempo real dedicado.",
    fr: "Ajoutez une tâche ci-dessus. En démarrer une ouvre un minuteur lié, afin que le tableau montre le temps réellement passé.",
    it: "Aggiungi un'attività sopra. Avviarne una apre un timer collegato, così il cruscotto mostra il tempo reale dedicato.",
    ja: "上にタスクを追加してください。開始するとリンクされたタイマーが立ち上がり、ダッシュボードに実際の作業時間が表示されます。",
  },
  "backlog.emptySection": { en: "Nothing in {section} yet.", es: "Nada en {section} todavía.", fr: "Rien dans {section} pour l'instant.", it: "Niente in {section} per ora.", ja: "{section}にはまだ何もありません。" },
  "backlog.completed": { en: "Completed", es: "Completadas", fr: "Terminées", it: "Completate", ja: "完了" },
  "backlog.completedEmpty": { en: "Nothing completed yet.", es: "Nada completado todavía.", fr: "Rien de terminé pour l'instant.", it: "Niente di completato per ora.", ja: "完了したものはまだありません。" },
  "backlog.confirm.title": { en: "Mark as completed?", es: "¿Marcar como completada?", fr: "Marquer comme terminée ?", it: "Segnare come completata?", ja: "完了にしますか？" },
  "backlog.confirm.body": { en: "\"{name}\" moves to the Completed section below.", es: "\"{name}\" pasa a la sección de Completadas abajo.", fr: "« {name} » passe dans la section Terminées ci-dessous.", it: "\"{name}\" passa alla sezione Completate qui sotto.", ja: "「{name}」を下の完了セクションに移動します。" },
  "backlog.confirm.confirm": { en: "Complete", es: "Completar", fr: "Terminer", it: "Completa", ja: "完了にする" },
  "backlog.confirm.cancel": { en: "Cancel", es: "Cancelar", fr: "Annuler", it: "Annulla", ja: "キャンセル" },
  "backlog.taskRowHint": { en: "Double-click to edit", es: "Doble clic para editar", fr: "Double-clic pour modifier", it: "Doppio clic per modificare", ja: "ダブルクリックで編集" },
  "backlog.completedBadge": { en: "Completed", es: "Completada", fr: "Terminée", it: "Completata", ja: "完了" },
  "backlog.reopen": { en: "Reopen into {section}", es: "Reabrir en {section}", fr: "Rouvrir dans {section}", it: "Riapri in {section}", ja: "{section}に戻す" },
  "backlog.deleteTask": { en: "Delete task", es: "Eliminar tarea", fr: "Supprimer la tâche", it: "Elimina attività", ja: "タスクを削除" },
  "backlog.completeTask": { en: "Complete task", es: "Completar tarea", fr: "Terminer la tâche", it: "Completa attività", ja: "タスクを完了" },
  "backlog.moveTo": { en: "Move to {section}", es: "Mover a {section}", fr: "Déplacer vers {section}", it: "Sposta in {section}", ja: "{section}に移動" },
  "backlog.start": { en: "Start {name}", es: "Iniciar {name}", fr: "Démarrer {name}", it: "Avvia {name}", ja: "{name} を開始" },
  "backlog.logged": { en: "{n} logged", es: "{n} registrado", fr: "{n} suivi", it: "{n} registrato", ja: "記録 {n}" },
  "backlog.edit.namePlaceholder": { en: "Task name", es: "Nombre de la tarea", fr: "Nom de la tâche", it: "Nome attività", ja: "タスク名" },
  "backlog.edit.sectionAria": { en: "Section", es: "Sección", fr: "Section", it: "Sezione", ja: "セクション" },
  "backlog.edit.projectAria": { en: "Project", es: "Proyecto", fr: "Projet", it: "Progetto", ja: "プロジェクト" },
  "backlog.edit.cancel": { en: "Cancel", es: "Cancelar", fr: "Annuler", it: "Annulla", ja: "キャンセル" },
  "backlog.edit.save": { en: "Save", es: "Guardar", fr: "Enregistrer", it: "Salva", ja: "保存" },

  "email.subject": { en: "Timer running for {elapsed}h, {label}", es: "Temporizador en marcha durante {elapsed}h, {label}", fr: "Minuteur en cours depuis {elapsed}h, {label}", it: "Timer in corso da {elapsed}h, {label}", ja: "タイマーが{elapsed}時間実行中、{label}" },
  "email.line1": {
    en: "A Cadence timer has been running for {elapsed} hours.",
    es: "Un temporizador de Cadence lleva funcionando {elapsed} horas.",
    fr: "Un minuteur Cadence tourne depuis {elapsed} heures.",
    it: "Un timer di Cadence è in corso da {elapsed} ore.",
    ja: "Cadenceのタイマーが{elapsed}時間実行中です。",
  },
  "email.desc": { en: "Description", es: "Descripción", fr: "Description", it: "Descrizione", ja: "説明" },
  "email.project": { en: "Project", es: "Proyecto", fr: "Projet", it: "Progetto", ja: "プロジェクト" },
  "email.task": { en: "Task", es: "Tarea", fr: "Tâche", it: "Attività", ja: "タスク" },
  "email.started": { en: "Started", es: "Iniciado", fr: "Démarré", it: "Iniziato", ja: "開始" },
  "email.at": { en: "at", es: "a las", fr: "à", it: "alle", ja: "" },
  "email.elapsed": { en: "Elapsed", es: "Transcurrido", fr: "Écoulé", it: "Trascorso", ja: "経過" },
  "email.nochange": {
    en: "Nothing has been changed. The timer is still running.",
    es: "No se ha cambiado nada. El temporizador sigue en marcha.",
    fr: "Rien n'a été modifié. Le minuteur est toujours en cours.",
    it: "Niente è stato modificato. Il timer è ancora in corso.",
    ja: "何も変更されていません。タイマーはまだ実行中です。",
  },
};

/** The live language for non-hook code (toast handlers, server email). */
let currentLang: Lang = "en";

export function setCurrentLang(lang: Lang): void {
  currentLang = lang;
}

export function getCurrentLang(): Lang {
  return currentLang;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}

export function t(key: string, params?: Record<string, string | number>, lang: Lang = currentLang): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  const value = entry[lang] ?? entry.en ?? key;
  return interpolate(value, params);
}

/** Plural helper for the four count-driven strings. */
export function plural(
  lang: Lang,
  n: number,
  oneKey: string,
  otherKey: string,
  params?: Record<string, string | number>,
): string {
  const key = n === 1 ? oneKey : otherKey;
  return t(key, { ...params, n }, lang);
}

export const BRAND = "Cadence";

/** Page <title>; the brand stays untranslated. */
export function metadataTitle(lang: Lang, pageKey: string): string {
  return `${t(pageKey, undefined, lang)} · ${BRAND}`;
}