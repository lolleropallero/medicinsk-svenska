import { describe, expect, it } from 'vitest';
import { validateClinicalScenarioContent } from '../../scripts/validate-content';
import type { ClinicalScenario, ClinicalScenarioCategory } from '../../src/types/content';

const categories: ClinicalScenarioCategory[] = [
  { id: 'anamneesi', nameFi: 'Esitiedot', status: 'published' },
  { id: 'paivystys', nameFi: 'Päivystys', status: 'published' },
  { id: 'kipu', nameFi: 'Kipu', status: 'published' },
  { id: 'hengitys', nameFi: 'Hengitysoireet', status: 'published' },
  { id: 'infektio', nameFi: 'Infektio', status: 'published' },
  { id: 'vatsa', nameFi: 'Vatsaoireet', status: 'published' },
  { id: 'laakitys', nameFi: 'Lääkitys', status: 'published' },
  { id: 'tutkimus', nameFi: 'Tutkimukset', status: 'published' },
  { id: 'toimenpide', nameFi: 'Toimenpiteeseen valmistautuminen', status: 'published' },
  { id: 'loydokset', nameFi: 'Löydökset ja jatko', status: 'published' },
  { id: 'kotiutus', nameFi: 'Kotiutus ja seuranta', status: 'published' },
];
const categoryIds = categories.map((item) => item.id);

function makeScenario(suffix: string, categoryId: string): ClinicalScenario {
  return {
    id: `tilanne-${categoryId}-${suffix}`, categoryId, titleFi: `Otsikko ${suffix}`, contextFi: `Konteksti ${suffix}.`,
    steps: [
      {
        id: 'step-1', patientSv: `Patientrad ett ${suffix}.`, promptFi: `Kehotus yksi ${suffix}.`,
        options: [
          { id: 'a', sv: `Rätt svar ${suffix}.`, correct: true },
          { id: 'b', sv: `Fel svar ett ${suffix}.`, correct: false },
          { id: 'c', sv: `Fel svar två ${suffix}.`, correct: false },
        ],
      },
      {
        id: 'step-2', patientSv: `Patientrad två ${suffix}.`, promptFi: `Kehotus kaksi ${suffix}.`,
        options: [
          { id: 'a', sv: `Fel svar tre ${suffix}.`, correct: false },
          { id: 'b', sv: `Rätt svar två ${suffix}.`, correct: true },
          { id: 'c', sv: `Fel svar fyra ${suffix}.`, correct: false },
          { id: 'd', sv: `Fel svar fem ${suffix}.`, correct: false },
        ],
        explanationFi: `Selitys ${suffix}.`,
      },
    ],
    resolutionSv: `Avslutning ${suffix}.`, resolutionFi: `Lopetus ${suffix}.`, status: 'published',
  };
}
// The validator requires at least 25 published scenarios with every published category non-empty,
// so the happy-path fixture covers all eleven categories and pads out to 25 with extra scenarios.
const minimalScenarios: ClinicalScenario[] = [
  ...categoryIds.map((id, index) => makeScenario(`base-${index}`, id)),
  ...Array.from({ length: Math.max(0, 25 - categoryIds.length) }, (_, index) => makeScenario(`extra-${index}`, categoryIds[index % categoryIds.length]!)),
];
const firstId = minimalScenarios[0]!.id;
const errorsFor = (scenarios: unknown[] = minimalScenarios, cats: unknown[] = categories) => validateClinicalScenarioContent(cats, scenarios);
const replaceScenario = (id: string, patch: Partial<ClinicalScenario> | ((scenario: ClinicalScenario) => unknown)) =>
  minimalScenarios.map((scenario) => (scenario.id === id
    ? (typeof patch === 'function' ? patch(scenario) : { ...scenario, ...patch })
    : scenario));
const withFirstSteps = (s: ClinicalScenario) => {
  const [stepOne, stepTwo] = s.steps;
  return { s, stepOne: stepOne!, stepTwo: stepTwo! };
};

describe('clinical scenario content validation', () => {
  it('accepts a minimal well-formed set', () => expect(errorsFor()).toEqual([]));

  it('rejects a category count other than the eleven curated categories', () => {
    expect(errorsFor(minimalScenarios, categories.slice(0, 10)).some((error) => error.includes('exactly 11'))).toBe(true);
    expect(errorsFor(minimalScenarios, [...categories, { id: 'ylimaarainen', nameFi: 'Ylimääräinen', status: 'published' }])
      .some((error) => error.includes('exactly 11'))).toBe(true);
  });

  it('rejects a missing or renamed required category', () => {
    const renamed = categories.map((item) => (item.id === 'kipu' ? { ...item, nameFi: 'Väärä nimi' } : item));
    expect(errorsFor(minimalScenarios, renamed).some((error) => error.includes('required published clinical scenario category'))).toBe(true);
  });

  it('rejects unknown properties on categories, scenarios, steps, and options', () => {
    expect(errorsFor(minimalScenarios, [...categories.slice(1), { ...categories[0], extra: true }])
      .some((error) => error.includes('unknown clinical scenario category properties'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, (s) => ({ ...s, extra: true })))
      .some((error) => error.includes('unknown clinical scenario properties'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, extra: true }, stepTwo] };
    })).some((error) => error.includes('unknown clinical scenario step properties'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, options: [{ ...stepOne.options[0], extra: true }, ...stepOne.options.slice(1)] }, stepTwo] };
    })).some((error) => error.includes('unknown clinical scenario option properties'))).toBe(true);
  });

  it('rejects a malformed or mismatched scenario ID', () => {
    expect(errorsFor(replaceScenario(firstId, { id: 'Not Valid ID' }))
      .some((error) => error.includes('invalid clinical scenario ID'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, { id: 'tilanne-otherCategory-test' }))
      .some((error) => error.includes('does not match category'))).toBe(true);
  });

  it('rejects a duplicate scenario ID', () => {
    const [first, second, ...rest] = minimalScenarios;
    expect(errorsFor([first!, { ...second!, id: first!.id }, ...rest]).some((error) => error.includes('duplicate clinical scenario ID'))).toBe(true);
  });

  it('rejects an unknown or unpublished scenario category', () => {
    expect(errorsFor(replaceScenario(firstId, { categoryId: 'missing', id: 'tilanne-missing-x' }))
      .some((error) => error.includes('unknown clinical scenario category'))).toBe(true);
    const unpublished = categories.map((item) => (item.id === 'kipu' ? { ...item, status: 'review' as const } : item));
    expect(errorsFor(minimalScenarios, unpublished).some((error) => error.includes('unpublished category'))).toBe(true);
  });

  it('rejects too few or too many steps', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => ({ ...s, steps: [s.steps[0]!] })))
      .some((error) => error.includes('between two and six steps'))).toBe(true);
    const sevenSteps = Array.from({ length: 7 }, (_, index) => ({
      id: `step-${index + 1}`, patientSv: `p${index}`, promptFi: `f${index}`,
      options: [{ id: 'a', sv: `a${index}`, correct: true }, { id: 'b', sv: `b${index}`, correct: false }, { id: 'c', sv: `c${index}`, correct: false }],
    }));
    expect(errorsFor(replaceScenario(firstId, (s) => ({ ...s, steps: sevenSteps })))
      .some((error) => error.includes('between two and six steps'))).toBe(true);
  });

  it('rejects non-sequential or duplicate step IDs', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, id: 'step-9' }, stepTwo] };
    })).some((error) => error.includes('must be sequential'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [stepOne, { ...stepTwo, id: 'step-1' }] };
    })).some((error) => error.includes('must be sequential') || error.includes('duplicate clinical scenario step ID'))).toBe(true);
  });

  it('rejects too few or too many options', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, options: stepOne.options.slice(0, 2) }, stepTwo] };
    })).some((error) => error.includes('three or four options'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [stepOne, { ...stepTwo, options: [...stepTwo.options, { id: 'e', sv: 'extra', correct: false }] }] };
    })).some((error) => error.includes('three or four options'))).toBe(true);
  });

  it('rejects option IDs out of the sequential a, b, c, d order', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, options: [{ ...stepOne.options[0], id: 'z' }, ...stepOne.options.slice(1)] }, stepTwo] };
    })).some((error) => error.includes('sequential (a, b, c, d)'))).toBe(true);
  });

  it('rejects zero or multiple correct options in a step', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, options: stepOne.options.map((o) => ({ ...o, correct: false })) }, stepTwo] };
    })).some((error) => error.includes('exactly one correct option'))).toBe(true);
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, options: stepOne.options.map((o) => ({ ...o, correct: true })) }, stepTwo] };
    })).some((error) => error.includes('exactly one correct option'))).toBe(true);
  });

  it('rejects duplicate option text within a step', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, options: [stepOne.options[0], { ...stepOne.options[1], sv: stepOne.options[0]!.sv }, stepOne.options[2]] }, stepTwo] };
    })).some((error) => error.includes('duplicate option text'))).toBe(true);
  });

  it('rejects empty, whitespace-broken, newline, or alternative-pattern text in every text field', () => {
    const fields: [string, (s: ClinicalScenario) => unknown][] = [
      ['titleFi', (s) => ({ ...s, titleFi: '' })],
      ['contextFi', (s) => ({ ...s, contextFi: '  padded  ' })],
      ['patientSv', (s) => { const { stepOne, stepTwo } = withFirstSteps(s); return { ...s, steps: [{ ...stepOne, patientSv: 'a/b' }, stepTwo] }; }],
      ['promptFi', (s) => { const { stepOne, stepTwo } = withFirstSteps(s); return { ...s, steps: [{ ...stepOne, promptFi: 'double  space' }, stepTwo] }; }],
      ['option.sv', (s) => {
        const { stepOne, stepTwo } = withFirstSteps(s);
        return { ...s, steps: [{ ...stepOne, options: [{ ...stepOne.options[0], sv: 'X' }, ...stepOne.options.slice(1)] }, stepTwo] };
      }],
      ['explanationFi', (s) => { const { stepOne, stepTwo } = withFirstSteps(s); return { ...s, steps: [stepOne, { ...stepTwo, explanationFi: 'line one\nline two' }] }; }],
      ['resolutionSv', (s) => ({ ...s, resolutionSv: 'a;b' })],
      ['resolutionFi', (s) => ({ ...s, resolutionFi: '' })],
    ];
    for (const [label, mutate] of fields) {
      const errors = errorsFor(replaceScenario(firstId, mutate));
      expect(errors.length, `expected an error for ${label}`).toBeGreaterThan(0);
    }
  });

  it('allows a mid-sentence ellipsis as a natural hesitation pause', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      return { ...s, steps: [{ ...stepOne, patientSv: 'Öh... jag vet inte riktigt.' }, stepTwo] };
    }))).toEqual([]);
  });

  it('treats explanationFi as optional', () => {
    expect(errorsFor(replaceScenario(firstId, (s) => {
      const { stepOne, stepTwo } = withFirstSteps(s);
      const { explanationFi: _drop, ...rest } = stepTwo;
      return { ...s, steps: [stepOne, rest] };
    }))).toEqual([]);
  });

  it('rejects fewer than 25 published clinical scenarios', () => {
    expect(errorsFor(minimalScenarios.slice(0, 24)).some((error) => error.includes('fewer than 25'))).toBe(true);
  });

  it('rejects a published category with no published scenarios', () => {
    const withoutKipu = minimalScenarios.filter((item) => item.categoryId !== 'kipu');
    expect(errorsFor(withoutKipu).some((error) => error.includes('published clinical scenario category is empty: kipu'))).toBe(true);
  });
});
