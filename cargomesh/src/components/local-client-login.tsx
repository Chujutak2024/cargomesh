import Link from 'next/link';
import styles from './password-login.module.css';
export function LocalClientLogin({connectedAvailable=true}:{connectedAvailable?:boolean}){return <form className={styles.card} action="/api/local/client-session" method="post">
 <h1>Client test access</h1><p className={styles.intro}>Explore the Client workspace with a predefined test profile.</p>
 <div className={styles.form}><label className={styles.field}>Test client<span className={styles.inputFrame}><input name="profile" value="Alex Morgan — Northstar Logistics" readOnly /></span></label>
 <p role="note">Local frontend preview · Sample data · No changes sent to Supabase.</p>
 <button className={styles.primaryAction} type="submit">Continue as test client</button>
 {connectedAvailable?<Link href="/login?returnTo=%2Fclients&connected=1">Use a connected Client account</Link>:null}</div>
 </form>;}
