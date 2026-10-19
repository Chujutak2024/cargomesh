import { CARRIER_LOGIN_PATH } from "@/shared/schemas/v2/carrier-portal";
import "./workspace-access-required.css";

/** Signed-out access state. Shares the approved waiting illustration and palette. */
export function WorkspaceAccessRequired({loginHref=CARRIER_LOGIN_PATH}:{loginHref?:string}={}) {
  return <div id="cm-access-proposal" className="cm-standalone">
    <section className="cm-screen" aria-label="Carrier workspace access">
      <header className="cm-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cm-logo" src="/carrier-access/logo.png" width={96} height={96} alt="CargoMesh" />
        <div className="cm-brand">CargoMesh<small>CARRIER WORKSPACE</small></div>
      </header>
      <main className="cm-panel">
        <div className="cm-copy">
          <p className="cm-eyebrow">BEFORE YOU CONTINUE</p>
          <h1>Oops!<br />Please sign in.</h1>
          <p className="cm-description">Sign in to access your carrier workspace and manage your operations.</p>
          <a className="cm-login" href={loginHref}>Sign in <span aria-hidden="true">→</span></a>
        </div>
        <div className="cm-scene-wrap">
          <div className="cm-scene" role="img" aria-label="A waiting truck with packages and soft smoke">
            <div className="cm-repair"><span className="cm-repair-symbol" aria-hidden="true">⚠</span><span>Waiting</span></div>
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
