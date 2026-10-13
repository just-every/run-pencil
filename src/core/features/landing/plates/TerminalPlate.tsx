import { Fragment } from 'react'
import { PencilCircle } from '../marks/PencilCircle'
import { SketchFrame } from '../marks/SketchFrame'
import { Plate, PlateNote } from './Plate'

/** Words that wrap only between each other, never inside one such as `--output` or a path. */
function Words({ children }: { readonly children: string }) {
  return <>{children.split(' ').map((word, index) => <Fragment key={index}>{index > 0 && ' '}<span className="nowrap">{word}</span></Fragment>)}</>
}

/** A command, its `$` prompt drawn but not read. */
function Command({ children }: { readonly children: string }) {
  return (
    <>
      <span className="terminal-sheet__prompt" aria-hidden="true">$</span> <Words>{children}</Words>
    </>
  )
}

/**
 * #yours: the operator commands as docs/guide/hosting.md (deploy dry run, deploy) and backup.md (export) give them. The
 * export's output path, exports/pencil.rer, is a drawn stand-in for backup.md's dated file name. None prints a line
 * the drawing could quote whole: the deploy dry run and deploy print build output and a health line, and export prints
 * a JSON summary, so the sheet shows commands only. The export command, the last line on the sheet, is circled whole
 * for the note beneath.
 */
export function TerminalPlate() {
  return (
    <Plate section="yours">
      <SketchFrame tone="sheet" radius={12} stacked className="plate-sheet terminal-sheet">
        <p className="terminal-sheet__line"><Command>pnpm run deploy -- --dry-run</Command></p>
        <p className="terminal-sheet__line"><Command>pnpm run deploy -- --environment production</Command></p>
        <p className="terminal-sheet__line">
          <PencilCircle block><Command>rer export --output exports/pencil.rer</Command></PencilCircle>
        </p>
      </SketchFrame>
      <PlateNote section="yours" />
    </Plate>
  )
}
