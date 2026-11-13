export function PageIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <section className="page-intro-band px-5 sm:px-8">
      <div className="page-intro-content mx-auto flex w-full max-w-345 items-center">
        <div className="max-w-3xl">
          <p className="page-intro-eyebrow text-xs font-bold uppercase tracking-[0.16em]">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
            {text}
          </p>
        </div>
      </div>
    </section>
  )
}