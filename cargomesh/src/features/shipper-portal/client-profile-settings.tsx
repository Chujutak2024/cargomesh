'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button, Checkbox, Input, Select } from '@/components/ui';
import { CatalogInputsV2, CatalogRecordV2Schema, parseCatalogRecordV2, type CatalogRecordV2 } from '@/shared/schemas/v2/catalog';
import { IntakeOptionsV2ResponseSchema, RequirementCodeV2Schema } from '@/shared/schemas/v2/intake-options';
import { EquipmentCodeV2Schema, TransportModeV2Schema, RankingObjectiveV2Schema } from '@/shared/schemas/v2/freight-request';
import { ClientSettingsError, collectionSchema, recordSchema, settingsRequest, settingsCommand, sendSettingsCommand, settingsError, type SettingsCommand } from './client-settings-api';
import styles from './client-settings.module.css';
import modalStyles from './cargo-profile-modal.module.css';

type Kind = 'cargo-profiles' | 'preferences';
type Profile = z.infer<typeof CatalogInputsV2['cargo-profiles']>;
type Preference = z.infer<typeof CatalogInputsV2['preferences']>;

function cleanDemoText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/^\[SYNTHETIC\]\s*/i, '').replace(/\s*·\s*Demo$/i, '').trim();
}

const blankProfile: Profile = {
  schemaVersion: '2.0',
  name: '',
  categoryId: '',
  typicalUnits: [],
  requirements: [],
  preferredEquipment: null,
  active: true,
};

const blankPreference: Preference = {
  schemaVersion: '2.0',
  objective: null,
  maximumWaitMinutes: null,
  preferredMode: null,
  preferredEquipment: null,
  usualBudget: null,
  validUntil: null,
};

const blankUnit = {
  packageType: 'PALLET',
  quantity: 1,
  weightPerUnitKg: 1,
  volumePerUnitM3: 1,
  dimensionsCm: { length: 100, width: 100, height: 100 },
  indivisible: false,
  stackable: false,
  unitsPerPackage: 1,
};

const endpoint = (kind: Kind) => (kind === 'cargo-profiles' ? '/cargo-profiles' : '/organizations/current/preferences');

export function ClientCatalogSettings({ kind, editable }: { kind: Kind; editable: boolean }) {
  const [records, setRecords] = useState<CatalogRecordV2[]>([]);
  const [selected, setSelected] = useState<CatalogRecordV2 | null>(null);
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [offset, setOffset] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const label = kind === 'cargo-profiles' ? 'Cargo profiles' : 'Transport preferences';
  const read = useRef(0);

  async function load(at = offset) {
    const ticket = ++read.current;
    setLoading(true);
    setError('');
    try {
      const response = await settingsRequest(
        endpoint(kind) + '?limit=25&offset=' + at,
        collectionSchema(CatalogRecordV2Schema)
      );
      if (ticket !== read.current) return;
      const current = response.data.map(v => parseCatalogRecordV2(kind, v));
      setRecords(current);
      setOffset(at);
      setNext(response.meta.nextOffset);
      if (kind === 'cargo-profiles') {
        const options = await settingsRequest('/intake/options', IntakeOptionsV2ResponseSchema);
        if (ticket === read.current) setCategories(options.data.cargoCategories);
      }
    } catch (e) {
      if (ticket === read.current) setError(settingsError(e));
    } finally {
      if (ticket === read.current) setLoading(false);
    }
  }

  async function open(id: string) {
    setError('');
    try {
      const response = await settingsRequest(endpoint(kind) + '/' + id, recordSchema(CatalogRecordV2Schema));
      setSelected(parseCatalogRecordV2(kind, response.data));
      setCreating(false);
    } catch (e) {
      setError(settingsError(e));
    }
  }

  useEffect(() => {
    void load(offset);
    return () => {
      read.current++;
    };
  }, []);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>{label}</h2>
          <p className={styles.muted}>
            {kind === 'cargo-profiles'
              ? 'Reuse saved cargo units and requirements when preparing a request.'
              : 'Preferences guide planning; they never authorize booking or confirm availability.'}
          </p>
        </div>
        {editable && (kind === 'cargo-profiles' || records.length === 0) && (
          <button
            type="button"
            className={modalStyles.createBtn}
            onClick={() => {
              setCreating(true);
              setSelected(null);
              setMessage('');
            }}
          >
            Create {kind === 'cargo-profiles' ? 'cargo profile' : 'preferences'}
          </button>
        )}
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error} <Button variant="secondary" onClick={() => void load()}>Retry</Button>
        </div>
      )}
      {message && <p className={styles.success} role="status">{message}</p>}

      {loading && !records.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0' }} aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={modalStyles.skeletonBone}
              style={{ height: '54px', borderRadius: '10px' }}
            />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {records.map(record => (
              <button
                className={styles.item}
                type="button"
                key={record.id}
                aria-pressed={selected?.id === record.id}
                onClick={() => void open(record.id)}
              >
                <strong>
                  {kind === 'cargo-profiles'
                    ? cleanDemoText((record.value as Profile).name) || (record.value as Profile).name
                    : 'Organization transport preferences'}
                </strong>
                <span className={styles.muted}>
                  Version {record.version} · {record.id}
                </span>
              </button>
            ))}
          </div>
          {!records.length && <p className={styles.empty}>No {label.toLowerCase()} saved.</p>}
          <div className={styles.actions}>
            {offset > 0 && (
              <Button variant="secondary" onClick={() => void load(Math.max(0, offset - 25))}>
                Previous
              </Button>
            )}
            {next !== null && (
              <Button variant="secondary" onClick={() => void load(next)}>
                Next
              </Button>
            )}
          </div>
        </>
      )}

      {(selected || creating) && (
        <CargoProfileModal
          key={selected ? selected.id + ':' + selected.version : 'new'}
          kind={kind}
          record={selected}
          editable={editable}
          categories={categories}
          onClose={() => {
            setSelected(null);
            setCreating(false);
          }}
          onReload={() => selected && void open(selected.id)}
          onSaved={async () => {
            setSelected(null);
            setCreating(false);
            setMessage(label + ' saved and read back from the database.');
            await load(offset);
          }}
        />
      )}
    </section>
  );
}

function CargoProfileModal({
  kind,
  record,
  editable,
  categories,
  onClose,
  onSaved,
  onReload,
}: {
  kind: Kind;
  record: CatalogRecordV2 | null;
  editable: boolean;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (value: CatalogRecordV2) => Promise<void>;
  onReload: () => void;
}) {
  const [value, setValue] = useState<Profile | Preference>(
    record
      ? (record.value as Profile | Preference)
      : kind === 'cargo-profiles'
      ? { ...blankProfile, categoryId: categories[0]?.id ?? '' }
      : blankPreference
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const pending = useRef<SettingsCommand | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || conflict) return;
    try {
      const parsed = CatalogInputsV2[kind].parse(value);
      const route = endpoint(kind) + (record ? '/' + record.id + '/revisions' : '');
      pending.current = settingsCommand(
        route,
        record ? { expectedVersion: record.version, value: parsed } : parsed,
        pending.current
      );
      setBusy(true);
      setError('');
      const response = await sendSettingsCommand(pending.current, recordSchema(CatalogRecordV2Schema));
      const current = await settingsRequest(endpoint(kind) + '/' + response.data.id, recordSchema(CatalogRecordV2Schema));
      pending.current = null;
      await onSaved(parseCatalogRecordV2(kind, current.data));
    } catch (e) {
      setError(settingsError(e));
      setConflict(e instanceof ClientSettingsError && e.code === 'STALE_DRAFT');
    } finally {
      setBusy(false);
    }
  }

  const titleText = record
    ? kind === 'cargo-profiles'
      ? `Edit cargo profile: ${cleanDemoText((record.value as Profile).name) || 'Saved profile'}`
      : 'Saved preferences'
    : kind === 'cargo-profiles'
    ? 'Create cargo profile'
    : 'New preferences';

  return (
    <div className={modalStyles.overlay} onClick={onClose} role="presentation">
      <div
        className={modalStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cargo-profile-modal-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative window header with 3 dots */}
        <div className={modalStyles.windowBar}>
          <div className={modalStyles.windowDots} aria-hidden="true">
            <span className={modalStyles.dotBlue} />
            <span className={modalStyles.dotPurple} />
            <span className={modalStyles.dotPink} />
          </div>
          <h3 id="cargo-profile-modal-title" className={modalStyles.windowTitle}>
            {titleText}
          </h3>
          <button
            type="button"
            className={modalStyles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* card__content container */}
        <div className={modalStyles.cardContent}>
          <form className={modalStyles.modalForm} onSubmit={save}>
            {!editable && (
              <p className={styles.notice}>
                Your role can view these settings. A manager with the required permissions can edit them.
              </p>
            )}

            <fieldset disabled={!editable || busy || conflict}>
              {kind === 'cargo-profiles' ? (
                <ProfileFields
                  value={value as Profile}
                  onChange={setValue}
                  categories={categories}
                />
              ) : (
                <PreferenceFields value={value as Preference} onChange={setValue} />
              )}
            </fieldset>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <div className={modalStyles.modalFooter}>
              <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              {editable && (
                <Button type="submit" disabled={conflict} isLoading={busy} loadingLabel="Saving…">
                  {error && !conflict ? 'Retry save' : record ? 'Save changes' : 'Save cargo profile'}
                </Button>
              )}
              {record && (
                <Button type="button" variant="secondary" disabled={busy} onClick={onReload}>
                  Reload latest
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Equipment({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: Profile['preferredEquipment']) => void;
}) {
  return (
    <Select
      label="Preferred equipment"
      value={value ?? ''}
      onChange={e => onChange((e.target.value as Profile['preferredEquipment']) || null)}
    >
      <option value="">No preference</option>
      {EquipmentCodeV2Schema.options.map(v => (
        <option key={v}>{v}</option>
      ))}
    </Select>
  );
}

function ProfileFields({
  value,
  onChange,
  categories,
}: {
  value: Profile;
  onChange: (value: Profile) => void;
  categories: { id: string; name: string }[];
}) {
  const updateUnit = (index: number, patch: Partial<Profile['typicalUnits'][number]>) =>
    onChange({
      ...value,
      typicalUnits: value.typicalUnits.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    });

  return (
    <>
      <div className={modalStyles.fieldsGrid}>
        <Input
          label="Profile name"
          value={cleanDemoText(value.name) || value.name}
          onChange={e => onChange({ ...value, name: e.target.value })}
          required
          maxLength={200}
        />
        <Select
          label="Cargo category"
          value={value.categoryId}
          onChange={e => onChange({ ...value, categoryId: e.target.value })}
          required
        >
          <option value="">Select a saved category</option>
          {!categories.some(v => v.id === value.categoryId) && value.categoryId && (
            <option value={value.categoryId}>Saved category (currently inactive)</option>
          )}
          {categories.map(v => (
            <option value={v.id} key={v.id}>
              {cleanDemoText(v.name) || v.name}
            </option>
          ))}
        </Select>
        <Equipment value={value.preferredEquipment} onChange={v => onChange({ ...value, preferredEquipment: v })} />
        <Checkbox
          label="Active profile"
          checked={value.active}
          onChange={e => onChange({ ...value, active: e.target.checked })}
        />
      </div>

      <div className={modalStyles.sectionBlock}>
        <h4 className={modalStyles.sectionTitle}>Handling Requirements</h4>
        <div className={modalStyles.reqGrid}>
          {RequirementCodeV2Schema.options.map(v => (
            <Checkbox
              key={v}
              label={v.replaceAll('_', ' ')}
              checked={value.requirements.includes(v)}
              onChange={e =>
                onChange({
                  ...value,
                  requirements: e.target.checked
                    ? [...value.requirements, v]
                    : value.requirements.filter(item => item !== v),
                })
              }
            />
          ))}
        </div>
        {value.requirements
          .filter(v => !RequirementCodeV2Schema.options.includes(v as typeof RequirementCodeV2Schema.options[number]))
          .map(v => (
            <p key={v} className={styles.muted}>
              Saved requirement: {v}
            </p>
          ))}
      </div>

      <div className={modalStyles.sectionBlock}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className={modalStyles.sectionTitle}>Cargo unit templates</h4>
          <Button
            type="button"
            variant="secondary"
            disabled={value.typicalUnits.length >= 100}
            onClick={() => onChange({ ...value, typicalUnits: [...value.typicalUnits, { ...blankUnit }] })}
          >
            + Add unit template
          </Button>
        </div>

        {!value.typicalUnits.length && (
          <p className={styles.notice}>No unit templates yet. Add a template to reuse dimensions and quantities.</p>
        )}

        {value.typicalUnits.map((unit, index) => (
          <div className={modalStyles.unitCard} key={index}>
            <div className={modalStyles.fieldsGrid}>
              <Select
                label="Packaging"
                value={unit.packageType}
                onChange={e => updateUnit(index, { packageType: e.target.value })}
              >
                {Array.from(new Set(['PALLET', 'BOX', 'CRATE', 'DRUM', 'BULK', unit.packageType])).map(v => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
              <Input
                label="Quantity"
                type="number"
                min={1}
                step={1}
                required
                value={unit.quantity}
                onChange={e => updateUnit(index, { quantity: Number(e.target.value) })}
              />
              <Input
                label="Weight per unit (kg)"
                type="number"
                min={0.000001}
                step="any"
                required
                value={unit.weightPerUnitKg}
                onChange={e => updateUnit(index, { weightPerUnitKg: Number(e.target.value) })}
              />
              <Input
                label="Volume per unit (m³)"
                type="number"
                min={0.000001}
                step="any"
                required
                value={unit.volumePerUnitM3}
                onChange={e => updateUnit(index, { volumePerUnitM3: Number(e.target.value) })}
              />
              {(['length', 'width', 'height'] as const).map(d => (
                <Input
                  key={d}
                  label={d[0].toUpperCase() + d.slice(1) + ' (cm)'}
                  type="number"
                  min={0.000001}
                  step="any"
                  required
                  value={unit.dimensionsCm[d]}
                  onChange={e =>
                    updateUnit(index, {
                      dimensionsCm: { ...unit.dimensionsCm, [d]: Number(e.target.value) },
                    })
                  }
                />
              ))}
              <Input
                label="Units per package"
                type="number"
                min={1}
                step={1}
                max={1000000}
                required
                value={unit.unitsPerPackage}
                onChange={e => updateUnit(index, { unitsPerPackage: Number(e.target.value) })}
              />
              <Checkbox
                label="Indivisible"
                checked={unit.indivisible}
                onChange={e => updateUnit(index, { indivisible: e.target.checked })}
              />
              <Checkbox
                label="Stackable"
                checked={unit.stackable}
                onChange={e => updateUnit(index, { stackable: e.target.checked })}
              />
            </div>
            <div className={modalStyles.unitActions}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => onChange({ ...value, typicalUnits: value.typicalUnits.filter((_, i) => i !== index) })}
              >
                Remove unit template
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PreferenceFields({
  value,
  onChange,
}: {
  value: Preference;
  onChange: (value: Preference) => void;
}) {
  return (
    <div className={modalStyles.fieldsGrid}>
      <Select
        label="Ranking objective"
        value={value.objective ?? ''}
        onChange={e => onChange({ ...value, objective: (e.target.value as Preference['objective']) || null })}
      >
        <option value="">No preference</option>
        {RankingObjectiveV2Schema.options.map(v => (
          <option key={v}>{v}</option>
        ))}
      </Select>
      <Input
        label="Maximum wait (minutes)"
        type="number"
        min={0}
        max={525600}
        step={1}
        value={value.maximumWaitMinutes ?? ''}
        onChange={e =>
          onChange({
            ...value,
            maximumWaitMinutes: e.target.value === '' ? null : Number(e.target.value),
          })
        }
      />
      <Select
        label="Preferred mode"
        value={value.preferredMode ?? ''}
        onChange={e => onChange({ ...value, preferredMode: (e.target.value as Preference['preferredMode']) || null })}
      >
        <option value="">No preference</option>
        {TransportModeV2Schema.options.map(v => (
          <option key={v}>{v}</option>
        ))}
      </Select>
      <Equipment value={value.preferredEquipment} onChange={v => onChange({ ...value, preferredEquipment: v })} />
      <Input
        label="Usual budget (USD)"
        type="number"
        min={0.01}
        step="any"
        value={value.usualBudget?.amount ?? ''}
        onChange={e =>
          onChange({
            ...value,
            usualBudget: e.target.value === '' ? null : { amount: Number(e.target.value), currency: 'USD' },
          })
        }
      />
      <Input
        label="Valid until (ISO instant, optional)"
        hint="Include Z or an explicit offset, for example 2026-11-01T00:00:00Z."
        value={value.validUntil ?? ''}
        onChange={e => onChange({ ...value, validUntil: e.target.value || null })}
      />
    </div>
  );
}
