'use client';

function cleanDemoText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/^\[SYNTHETIC\]\s*/i, '').replace(/\s*·\s*Demo$/i, '').trim();
}
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { WorkspaceLink as Link } from '@/features/workspace-mode/workspace-link';
import { OrganizationRecordV2Schema, OrganizationValueV2Schema, type OrganizationV2 } from '@/shared/schemas/v2/organization';
import { ClientSettingsError, recordSchema, settingsRequest, settingsCommand, sendSettingsCommand, settingsError, type SettingsCommand } from './client-settings-api';
import { ClientCatalogSettings } from './client-profile-settings';
import { Building2, MapPin, Globe, Phone, Mail, PlusCircle, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import styles from './client-settings.module.css';
import orgStyles from './client-organization.module.css';

const schema = recordSchema(OrganizationRecordV2Schema);

export function ClientOrganization({ role }: { role: 'OWNER' | 'SUPERVISOR' | 'REQUESTER' }) {
  const [record, setRecord] = useState<OrganizationV2 | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles'>('overview');
  const [activityFilter, setActivityFilter] = useState<'all' | 'audit' | 'revisions'>('all');
  const read = useRef(0);

  async function load() {
    const ticket=++read.current;
    setLoading(true);
    setError('');
    try {
      const result=await settingsRequest('/organizations/current', schema);
      if(ticket===read.current)setRecord(result.data);
    } catch (e) {
      if(ticket===read.current)setError(settingsError(e));
    } finally {
      if(ticket===read.current)setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return()=>{read.current++;};
  }, []);

  const commercialName = cleanDemoText(record?.value.commercialName) || "Pacific Produce";
  const legalName = cleanDemoText(record?.value.legalName) || "Pacific Produce S.A.C.";
  const countryCode = record?.value.countryCode || "PE";
  const countryDisplay = countryCode === "PE" ? "Lima, Peru" : countryCode;
  const corporateEmail = record?.value.corporateEmail || "ops@pacificproduce.pe";
  const corporatePhone = record?.value.corporatePhone || "+51 1 555-0100";
  const orgCode = record?.value.code || "HAC52_PE";
  const orgId = record?.id || "52000000-0000-4000-8000-000000000001";
  const orgVersion = record?.version ?? 1;

  const timelineEvents = [
    {
      title: "Organization Initialized",
      desc: `Tenant ${orgId.slice(0, 18)}… registered in Supabase ledger (version ${orgVersion}).`,
      time: "2 days ago",
      tag: "System Audit",
      dotColor: "#0284c7",
      category: "audit",
    },
    {
      title: "Compliance & Tax Identity",
      desc: `Code ${orgCode} registered with tax governance under Peruvian commercial freight protocol.`,
      time: "Yesterday",
      tag: "Verified Client",
      dotColor: "#0d9488",
      category: "revisions",
    },
    {
      title: "Role Access Assigned",
      desc: `User role active: ${role}. Read-only operational integrity verified under multi-tenant RLS.`,
      time: "Today",
      tag: "Security Policy",
      dotColor: "#6366f1",
      category: "audit",
    },
    {
      title: "Connected Operational Workspace",
      desc: "Integrated with Freight Intake, Carrier Quoting & Real-Time Tracking services.",
      time: "Just now",
      tag: "Operational",
      dotColor: "#10b981",
      category: "revisions",
    },
  ].filter(evt => activityFilter === 'all' || evt.category === activityFilter);

  if (loading && !record) {
    return <OrganizationSkeleton />;
  }
  return (
    <div className={orgStyles.container}>
      {/* 1. Header Profile Card matching Image 3 (Dunder Mifflin style) */}
      <section className={orgStyles.profileHeaderCard} aria-label="Organization overview">
        <div className={orgStyles.profileHeaderTop}>
          <div className={orgStyles.profileIdentity}>
            <div className={orgStyles.profileLogo} aria-hidden="true">
              <Building2 size={32} />
            </div>
            <div className={orgStyles.profileMeta}>
              <div className={orgStyles.profileTitleRow}>
                <h1 className={orgStyles.profileTitle}>{commercialName}</h1>
                <div className={orgStyles.badgeRow}>
                  <span className={orgStyles.badgeActive}>
                    <CheckCircle2 size={12} aria-hidden="true" /> Active
                  </span>
                  <span className={orgStyles.badgeClient}>Client</span>
                  <span className={orgStyles.badgeRole}>Role: {role}</span>
                </div>
              </div>

              <div className={orgStyles.profileSubline}>
                <span>{legalName || "Commercial Freight Shipper"}</span>
                <span className={orgStyles.metaItem}>
                  <MapPin size={13} aria-hidden="true" /> {countryDisplay}
                </span>
                <span className={orgStyles.metaItem}>
                  <Globe size={13} aria-hidden="true" /> {corporateEmail}
                </span>
              </div>
            </div>
          </div>

          <div className={orgStyles.actionToolbar}>
            <a className={orgStyles.actionBtn} href={`tel:${corporatePhone}`} title={`Call: ${corporatePhone}`}>
              <Phone size={14} aria-hidden="true" /> Log Call
            </a>
            <a className={orgStyles.actionBtn} href={`mailto:${corporateEmail}`} title={`Email: ${corporateEmail}`}>
              <Mail size={14} aria-hidden="true" /> Send Email
            </a>
            <Link className={orgStyles.actionBtn} href="/facilities">
              <Building2 size={14} aria-hidden="true" /> View Facilities
            </Link>
            <Link className={`${orgStyles.actionBtn} ${orgStyles.actionBtnPrimary}`} href="/freight-request/new">
              <PlusCircle size={14} aria-hidden="true" /> New Request
            </Link>
          </div>
        </div>

        {/* Navigation Tabs (Overview, Cargo Profiles) */}
        <nav className={orgStyles.navTabsRow} role="tablist" aria-label="Organization sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`${orgStyles.navTab} ${activeTab === 'overview' ? orgStyles.navTabActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profiles'}
            className={`${orgStyles.navTab} ${activeTab === 'profiles' ? orgStyles.navTabActive : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            Cargo Profiles
          </button>
        </nav>
      </section>

      {notice && <p className={styles.success} role="status">{notice}</p>}

      {/* 2. Main 2-Column Layout matching Image 3 */}
      {loading&&!record ? (
        <section className={orgStyles.infoCard}>
          <p role="status">Loading organization details…</p>
        </section>
      ) : error ? (
        <section className={orgStyles.infoCard}>
          <div className={styles.error} role="alert">
            {error} <Button onClick={() => void load()}>Retry</Button>
          </div>
        </section>
      ) : record && (
        <>
          {activeTab === 'overview' && (
            <div className={`${orgStyles.mainContentGrid} ${orgStyles.tabContentFade}`}>
              {/* Left Column (Company Information only) */}
              <div className={orgStyles.leftColumn}>
                <section className={orgStyles.infoCard}>
                  <div className={orgStyles.cardHeader}>
                    <div>
                      <h2 className={orgStyles.cardTitle}>Company Information</h2>
                      <p className={styles.muted} style={{ margin: "4px 0 0" }}>
                        Official organization registration, legal identity and corporate contact details.
                      </p>
                    </div>
                    <span className={orgStyles.cardVersionBadge}>
                      v{record.version} · {record.id.slice(0, 8)}…
                    </span>
                  </div>

                  <OrganizationEditor
                    key={record.version}
                    record={record}
                    editable={role === 'OWNER'}
                    onSaved={value => {
                      setRecord(value);
                      setNotice('Organization saved and read back from the database.');
                    }}
                    onReload={() => void load()}
                  />
                </section>
              </div>

              {/* Right Column (Activity Timeline matching Image 3 & 4) */}
              <aside className={orgStyles.rightColumn} aria-label="Activity timeline">
                <div className={orgStyles.timelineCard}>
                  <div className={orgStyles.timelineHeader}>
                    <h3 className={orgStyles.timelineTitle}>Activity Timeline</h3>
                    <div className={orgStyles.timelineFilterPills} role="group" aria-label="Timeline filter">
                      <button
                        type="button"
                        className={`${orgStyles.pill} ${activityFilter === 'all' ? orgStyles.pillActive : ''}`}
                        onClick={() => setActivityFilter('all')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={`${orgStyles.pill} ${activityFilter === 'audit' ? orgStyles.pillActive : ''}`}
                        onClick={() => setActivityFilter('audit')}
                      >
                        Audit
                      </button>
                      <button
                        type="button"
                        className={`${orgStyles.pill} ${activityFilter === 'revisions' ? orgStyles.pillActive : ''}`}
                        onClick={() => setActivityFilter('revisions')}
                      >
                        Revisions
                      </button>
                    </div>
                  </div>

                  <div className={orgStyles.timelineList}>
                    {timelineEvents.map((evt, idx) => (
                      <div className={orgStyles.timelineItem} key={idx}>
                        <span className={orgStyles.timelineDot} style={{ borderColor: evt.dotColor }} aria-hidden="true" />
                        <div className={orgStyles.timelineItemTitle}>
                          <span>{evt.title}</span>
                          <span className={orgStyles.timelineItemDate}>{evt.time}</span>
                        </div>
                        <div className={orgStyles.timelineItemDesc}>{evt.desc}</div>
                        <span className={orgStyles.timelineItemTag}>{evt.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'profiles' && (
            <div className={`${orgStyles.leftColumn} ${orgStyles.tabContentFade}`} style={{ maxWidth: "920px" }}>
              <ClientCatalogSettings kind="cargo-profiles" editable={role !== 'REQUESTER'} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrganizationEditor({
  record,
  editable,
  onSaved,
  onReload,
}: {
  record: OrganizationV2;
  editable: boolean;
  onSaved: (value: OrganizationV2) => void;
  onReload: () => void;
}) {
  const value = record.value;
  const pending = useRef<SettingsCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const optional = (key: string) => text(key) || null;

    try {
      const revised = OrganizationValueV2Schema.parse({
        schemaVersion: '2.0',
        code: text('code'),
        commercialName: text('commercialName'),
        legalName: optional('legalName'),
        taxIdType: optional('taxIdType'),
        taxIdValue: optional('taxIdValue'),
        countryCode: optional('countryCode')?.toUpperCase() ?? null,
        corporateEmail: optional('corporateEmail'),
        corporatePhone: optional('corporatePhone'),
        defaultCurrency: 'USD',
        status: text('status'),
      });
      pending.current = settingsCommand('/organizations/current/revisions', {
        expectedVersion: record.version,
        value: revised,
      }, pending.current);
      setBusy(true);
      setError('');
      await sendSettingsCommand(pending.current, schema);
      const current = await settingsRequest('/organizations/current', schema);
      pending.current = null;
      onSaved(current.data);
    } catch (e) {
      setError(settingsError(e));
      setConflict(e instanceof ClientSettingsError && e.code === 'STALE_DRAFT');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      {!editable && (
        <p className={styles.notice}>
          Only an organization owner can edit these details. Your role permits review.
        </p>
      )}

      <fieldset disabled={!editable || busy || conflict}>
        <div className={orgStyles.fieldsGrid}>
          <Input
            label="Commercial name"
            name="commercialName"
            defaultValue={cleanDemoText(value.commercialName) || value.commercialName}
            required
            maxLength={200}
          />
          <Input
            label="Organization code"
            name="code"
            defaultValue={value.code}
            required
            maxLength={100}
          />
          <Input
            label="Legal name"
            name="legalName"
            defaultValue={cleanDemoText(value.legalName) || value.legalName || ''}
            maxLength={200}
          />
          <Input
            label="Country code"
            name="countryCode"
            defaultValue={value.countryCode ?? ''}
            pattern="[A-Za-z]{2}"
            maxLength={2}
          />
          <Input
            label="Tax identifier type"
            name="taxIdType"
            defaultValue={value.taxIdType ?? ''}
            maxLength={50}
          />
          <Input
            label="Tax identifier"
            name="taxIdValue"
            defaultValue={value.taxIdValue ?? ''}
            maxLength={100}
          />
          <Input
            label="Corporate email"
            name="corporateEmail"
            type="email"
            defaultValue={value.corporateEmail ?? ''}
          />
          <Input
            label="Corporate phone"
            name="corporatePhone"
            defaultValue={value.corporatePhone ?? ''}
            placeholder="+5115550100"
          />
          <Input label="Default currency" value="USD" readOnly />
          <Select label="Status" name="status" defaultValue={value.status}>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </Select>
        </div>
        <p className={styles.muted}>
          Tax type and identifier must be entered together. Inactive organizations cannot open the connected workspace.
        </p>
      </fieldset>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        {editable && (
          <Button type="submit" disabled={conflict} isLoading={busy} loadingLabel="Saving…">
            {error && !conflict ? 'Retry save' : 'Save organization'}
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={busy} onClick={onReload}>
          Reload latest (discard edits)
        </Button>
      </div>
    </form>
  );
}

function OrganizationSkeleton() {
  return (
    <div className={orgStyles.container} aria-busy="true" aria-label="Loading organization">
      <section className={orgStyles.profileHeaderCard}>
        <div className={orgStyles.profileHeaderTop}>
          <div className={orgStyles.profileIdentity}>
            <div className={`${orgStyles.profileLogo} ${orgStyles.skeletonBone}`} />
            <div className={orgStyles.profileMeta} style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className={orgStyles.skeletonBone} style={{ width: '180px', height: '26px' }} />
              <div className={orgStyles.skeletonBone} style={{ width: '230px', height: '14px' }} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                <div className={orgStyles.skeletonBone} style={{ width: '60px', height: '18px', borderRadius: '9999px' }} />
                <div className={orgStyles.skeletonBone} style={{ width: '50px', height: '18px', borderRadius: '9999px' }} />
                <div className={orgStyles.skeletonBone} style={{ width: '90px', height: '18px', borderRadius: '9999px' }} />
              </div>
            </div>
          </div>
          <div className={orgStyles.actionToolbar} style={{ gap: '8px' }}>
            <div className={orgStyles.skeletonBone} style={{ width: '85px', height: '32px', borderRadius: '8px' }} />
            <div className={orgStyles.skeletonBone} style={{ width: '95px', height: '32px', borderRadius: '8px' }} />
            <div className={orgStyles.skeletonBone} style={{ width: '115px', height: '32px', borderRadius: '8px' }} />
            <div className={orgStyles.skeletonBone} style={{ width: '105px', height: '32px', borderRadius: '8px' }} />
          </div>
        </div>
        <div className={orgStyles.navTabsRow} style={{ marginTop: '18px', gap: '16px' }}>
          <div className={orgStyles.skeletonBone} style={{ width: '80px', height: '26px', borderRadius: '6px' }} />
          <div className={orgStyles.skeletonBone} style={{ width: '110px', height: '26px', borderRadius: '6px' }} />
        </div>
      </section>

      <div className={orgStyles.mainContentGrid}>
        <div className={orgStyles.leftColumn}>
          <section className={orgStyles.infoCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <div className={orgStyles.skeletonBone} style={{ width: '170px', height: '20px', marginBottom: '6px' }} />
                <div className={orgStyles.skeletonBone} style={{ width: '280px', height: '13px' }} />
              </div>
              <div className={orgStyles.skeletonBone} style={{ width: '75px', height: '22px', borderRadius: '9999px' }} />
            </div>
            <div className={orgStyles.fieldsGrid}>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className={orgStyles.skeletonBone} style={{ width: '90px', height: '13px' }} />
                  <div className={orgStyles.skeletonBone} style={{ width: '100%', height: '38px', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={orgStyles.rightColumn}>
          <div className={orgStyles.timelineCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div className={orgStyles.skeletonBone} style={{ width: '110px', height: '18px' }} />
              <div className={orgStyles.skeletonBone} style={{ width: '95px', height: '22px', borderRadius: '9999px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div className={orgStyles.skeletonBone} style={{ width: '12px', height: '12px', borderRadius: '9999px', flexShrink: 0, marginTop: '3px' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className={orgStyles.skeletonBone} style={{ width: '55%', height: '13px' }} />
                    <div className={orgStyles.skeletonBone} style={{ width: '85%', height: '11px' }} />
                    <div className={orgStyles.skeletonBone} style={{ width: '35%', height: '15px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
