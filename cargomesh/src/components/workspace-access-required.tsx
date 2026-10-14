import "./workspace-access-required.css";

/** Signed-out access state. Shares the approved waiting illustration and palette. */
export function WorkspaceAccessRequired() {
  return <div id="cm-access-proposal" className="cm-standalone">
    <section className="cm-screen" aria-label="Acceso al portal del transportista">
      <header className="cm-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cm-logo" src="/carrier-access/logo.png" width={96} height={96} alt="CargoMesh" />
        <div className="cm-brand">CargoMesh<small>PORTAL DEL TRANSPORTISTA</small></div>
      </header>
      <main className="cm-panel">
        <div className="cm-copy">
          <p className="cm-eyebrow">ANTES DE CONTINUAR</p>
          <h1>¡Ups!<br />Falta iniciar sesión.</h1>
          <p className="cm-description">Ingresa a tu cuenta para acceder al espacio de tu transportista y empezar a operar.</p>
          <a className="cm-login" href="/login?returnTo=%2Fv2-workspace">Iniciar sesión <span aria-hidden="true">→</span></a>
        </div>
        <div className="cm-scene-wrap">
          <div className="cm-scene" role="img" aria-label="Camión en espera, con cajas y humo suave">
            <div className="cm-repair"><span className="cm-repair-symbol" aria-hidden="true">⚠</span><span>En espera</span></div>
            <div className="cm-horizon" /><div className="cm-road" />
            <div className="cm-truck">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/carrier-access/waiting-truck.png" width={828} height={537} alt="" />
              <span className="cm-beacon" /><span className="cm-tail" />
            </div>
            {['a','b','c','d','e'].map(id=><div key={id} className={'cm-parcel cm-parcel-'+id} aria-hidden="true"><span className="cm-parcel-top"/><span className="cm-parcel-front"/><span className="cm-parcel-side"/></div>)}
            <div className="cm-smoke" aria-hidden="true"><span/><span/><span/><span/></div>
          </div>
        </div>
      </main>
    </section>
  </div>;
}
