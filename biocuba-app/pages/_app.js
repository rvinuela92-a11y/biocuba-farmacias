import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #f5f4f0; --surf: #fff; --s2: #f0efe9; --bdr: #e2e0d8; --bdr2: #c8c5bb;
            --tx: #1a1916; --t2: #6b6860; --t3: #9e9b93;
            --green: #2a5c3a; --gbg: #e5f0e8; --gbdr: #aed0b8;
            --red: #c0392b; --rbg: #fde8e8; --rbdr: #e8aaaa;
            --amber: #7a5100; --abg: #fef8ec; --abdr: #e8d5a3;
            --blue: #1a4a8a; --bbg: #eef3fc; --bbdr: #c5d8f5;
            --br: #e53030; --font: 'DM Sans', sans-serif; --mono: 'Inter', sans-serif;
          }
          html { -webkit-text-size-adjust: 100%; }
          body { font-family: var(--font); background: var(--bg); color: var(--tx); min-height: 100vh; }
          button { cursor: pointer; font-family: var(--font); }
        `}</style>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
