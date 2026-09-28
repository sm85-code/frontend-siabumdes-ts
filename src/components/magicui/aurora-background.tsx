/** Aurora blobs — pure CSS animation (see .wallpaper-aurora-blob in index.css).
 * Colors use color-mix against oklch theme tokens (Tailwind v4). */
export function AuroraBackground() {
  return (
    <div className="absolute inset-0">
      <div
        className="wallpaper-aurora-blob"
        style={{
          width: '30vw',
          height: '30vw',
          top: '-10%',
          left: '-8%',
          background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
        }}
      />
      <div
        className="wallpaper-aurora-blob"
        style={{
          width: '26vw',
          height: '26vw',
          top: '-6%',
          right: '-10%',
          background: 'color-mix(in oklch, var(--ring) 8%, transparent)',
          animationDelay: '-4s',
        }}
      />
      <div
        className="wallpaper-aurora-blob"
        style={{
          width: '34vw',
          height: '34vw',
          bottom: '-18%',
          left: '20%',
          background: 'color-mix(in oklch, var(--primary) 6%, transparent)',
          animationDelay: '-9s',
        }}
      />
    </div>
  )
}
