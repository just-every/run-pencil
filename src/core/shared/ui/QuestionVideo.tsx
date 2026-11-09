import { useState } from 'react'
import { questionVideoEmbed, questionVideoValid, type QuestionVideo as Video } from '../questionVideo'
import './question-video.css'

/** No provider resource exists in the initial tree, including server rendering. */
export function QuestionVideo({ value, disabled = false }: { value: unknown; disabled?: boolean }) {
  if (!questionVideoValid(value)) return null
  return <VideoPlayer key={`${value.provider}:${value.reference}`} video={value} disabled={disabled} />
}

function VideoPlayer({ video, disabled }: { video: Video; disabled: boolean }) {
  const [playing, setPlaying] = useState(false)
  const provider = video.provider === 'youtube' ? 'YouTube' : 'Vimeo'
  return <section className="question-video" aria-label="Question video">
    {playing ? <iframe className="question-video-frame" title={`${provider} video`} src={questionVideoEmbed(video)}
      referrerPolicy="no-referrer" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-presentation" />
      : <div className="question-video-placeholder"><p>{provider} video loads only when you press Play. Playing connects to {provider}.</p>
        <button className="secondary-button focus-ring" type="button" disabled={disabled} onClick={() => setPlaying(true)}>Play video</button>
      </div>}
  </section>
}
