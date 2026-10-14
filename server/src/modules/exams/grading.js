import { query } from '../../config/db.js';
import { round } from '../../utils/sql.js';

/**
 * Grading engine. Scales live in the `grades` table (NECTA bands by default, editable per school).
 *
 * O-Level (CSEE): division from the sum of the best 7 subject points (A=1 ... F=5)
 *   I: 7–17, II: 18–21, III: 22–25, IV: 26–33, 0: 34–35
 * A-Level (ACSEE): division from the best 3 subject points (A=1 ... F=7)
 *   I: 3–9, II: 10–12, III: 13–17, IV: 18–19, 0: 20–21
 * Primary / Nursery: overall grade from the average percentage.
 */

const DIVISION_RULES = {
  o_level: {
    bestOf: 7,
    bands: [
      { min: 7, max: 17, division: 'I' },
      { min: 18, max: 21, division: 'II' },
      { min: 22, max: 25, division: 'III' },
      { min: 26, max: 33, division: 'IV' },
      { min: 34, max: 35, division: '0' },
    ],
  },
  a_level: {
    bestOf: 3,
    bands: [
      { min: 3, max: 9, division: 'I' },
      { min: 10, max: 12, division: 'II' },
      { min: 13, max: 17, division: 'III' },
      { min: 18, max: 19, division: 'IV' },
      { min: 20, max: 21, division: '0' },
    ],
  },
};

const DIVISION_REMARKS = { I: 'Distinction', II: 'Merit', III: 'Credit', IV: 'Pass', 0: 'Fail' };
const RANKED_REMARKS = ['Distinction', 'Merit', 'Credit'];

export async function loadGradingScales(executor) {
  const rows = await query(
    `SELECT level, grade, min_score AS minScore, max_score AS maxScore, points, remark
       FROM grades ORDER BY level, min_score DESC`,
    [],
    executor,
  );
  const scales = {};
  for (const row of rows) {
    if (!scales[row.level]) scales[row.level] = [];
    scales[row.level].push({
      grade: row.grade,
      minScore: Number(row.minScore),
      maxScore: Number(row.maxScore),
      points: Number(row.points),
      remark: row.remark,
    });
  }
  return scales;
}

/** Nursery has no national scale, so it falls back to the primary scale. */
export function scaleForLevel(scales, level) {
  if (scales[level]?.length) return scales[level];
  return scales.primary || [];
}

export function gradeFor(scale, percentage) {
  if (percentage === null || percentage === undefined || scale.length === 0) return null;
  const value = round(percentage, 2);
  return scale.find((band) => value >= band.minScore) || scale[scale.length - 1];
}

export function isFailingBand(scale, band) {
  return Boolean(band) && scale.length > 0 && band.grade === scale[scale.length - 1].grade;
}

export function percentageOf(score, maxScore) {
  if (score === null || score === undefined) return null;
  return round((Number(score) / Number(maxScore)) * 100, 2);
}

/**
 * Overall result for one student.
 * @param {string} level class level
 * @param {Array} scale grading bands for the level
 * @param {Array<{points:number}>} gradedSubjects subjects the student sat (with band points)
 * @param {number|null} averagePct average percentage across sat subjects
 */
export function computeOverall(level, scale, gradedSubjects, averagePct) {
  const overallBand = gradeFor(scale, averagePct);
  const averageGrade = overallBand?.grade ?? null;
  const rule = DIVISION_RULES[level];

  if (rule) {
    const points = gradedSubjects
      .map((subject) => subject.points)
      .filter((value) => value !== null && value !== undefined)
      .sort((a, b) => a - b);

    if (points.length < rule.bestOf) {
      return {
        type: 'division',
        label: 'Division',
        value: 'INC',
        points: null,
        bestOf: rule.bestOf,
        averageGrade,
        remark: 'Incomplete',
        passed: averageGrade !== null && !isFailingBand(scale, overallBand),
      };
    }

    const total = points.slice(0, rule.bestOf).reduce((sum, value) => sum + value, 0);
    const band = rule.bands.find((entry) => total >= entry.min && total <= entry.max)
      || rule.bands[rule.bands.length - 1];
    return {
      type: 'division',
      label: 'Division',
      value: band.division,
      points: round(total, 1),
      bestOf: rule.bestOf,
      averageGrade,
      remark: DIVISION_REMARKS[band.division],
      passed: band.division !== '0',
    };
  }

  if (!overallBand) {
    return { type: 'grade', label: 'Overall Grade', value: '-', points: null, averageGrade: null, remark: null, passed: false };
  }
  const index = scale.findIndex((band) => band.grade === overallBand.grade);
  const failing = isFailingBand(scale, overallBand);
  return {
    type: 'grade',
    label: 'Overall Grade',
    value: overallBand.grade,
    points: null,
    averageGrade,
    remark: failing ? 'Fail' : (RANKED_REMARKS[index] ?? 'Pass'),
    passed: !failing,
  };
}

/** Printable grading key, e.g. "A: 75–100  B: 65–74.99 ...". */
export function describeScale(scale) {
  return scale.map((band) => ({
    grade: band.grade,
    minScore: band.minScore,
    maxScore: band.maxScore,
    range: `${band.minScore}–${band.maxScore}`,
    points: band.points,
    remark: band.remark,
  }));
}
