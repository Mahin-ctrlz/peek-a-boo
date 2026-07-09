// Peek — grades.js
//
// Shared grade-point scale + pure calculation functions. No DOM, no
// storage, no network — just math, so it's easy to trust and easy to
// re-tune if a university's exact scale differs slightly.
//
// Scale used: Bangladesh UGC-style 4.00 CGPA system, the common scale
// across most Bangladeshi private universities. If your university's
// transcript uses different exact values (some use 2.75 for B- / 2.50
// for C+, others skip those steps entirely), edit GRADE_SCALE below —
// everything else in this file derives from it automatically.

(() => {
  const GRADE_SCALE = [
    { letter: 'A+', point: 4.00 },
    { letter: 'A',  point: 3.75 },
    { letter: 'A-', point: 3.50 },
    { letter: 'B+', point: 3.25 },
    { letter: 'B',  point: 3.00 },
    { letter: 'B-', point: 2.75 },
    { letter: 'C+', point: 2.50 },
    { letter: 'C',  point: 2.25 },
    { letter: 'D',  point: 2.00 },
    { letter: 'F',  point: 0.00 },
  ];

  // Grades that a university records but that don't count toward GPA/CGPA
  // (incomplete, withdrawal, repeat-in-progress). Matches the UGC
  // convention described in university academic-policy pages.
  const NON_GPA_GRADES = new Set(['I', 'W', 'R']);

  function pointForLetter(letter) {
    const hit = GRADE_SCALE.find((g) => g.letter === letter.trim().toUpperCase());
    return hit ? hit.point : null;
  }

  function letterForPoint(point) {
    // Closest match at or below the target, for display purposes only.
    let best = GRADE_SCALE[GRADE_SCALE.length - 1];
    for (const g of GRADE_SCALE) {
      if (g.point <= point + 1e-9 && g.point > best.point) best = g;
    }
    return best.letter;
  }

  // A parsed course: { credit: number, grade: string, point: number|null }
  // point is null for non-GPA grades (I/W/R) — callers should exclude
  // these from credit/point sums, matching how CGPA is actually computed.
  function parseCourse(credit, gradeLetter) {
    const letter = (gradeLetter || '').trim().toUpperCase();
    const c = Number(credit);
    if (NON_GPA_GRADES.has(letter) || letter === '') {
      return { credit: Number.isFinite(c) ? c : 0, grade: letter, point: null };
    }
    return { credit: Number.isFinite(c) ? c : 0, grade: letter, point: pointForLetter(letter) };
  }

  // Sum credit*point over only GPA-counting courses.
  function summarize(courses) {
    let creditSum = 0;
    let qualityPoints = 0;
    for (const c of courses) {
      if (c.point == null) continue; // skip I/W/R/unrecognized
      creditSum += c.credit;
      qualityPoints += c.credit * c.point;
    }
    const cgpa = creditSum > 0 ? qualityPoints / creditSum : 0;
    return { creditSum, qualityPoints, cgpa };
  }

  // What-if: combine real completed courses with hypothetical future ones.
  function whatIf(completedCourses, hypotheticalCourses) {
    const before = summarize(completedCourses);
    const after = summarize([...completedCourses, ...hypotheticalCourses]);
    return { before, after };
  }

  // Target-grade helper: given current standing, remaining credits, and a
  // target CGPA, what average grade point do the remaining credits need?
  // Returns null if the target is mathematically unreachable (needs a
  // grade point above 4.00) or already guaranteed (needs below 0).
  function requiredAveragePoint(currentQualityPoints, currentCreditSum, remainingCredits, targetCgpa) {
    if (remainingCredits <= 0) return null;
    const neededTotal = targetCgpa * (currentCreditSum + remainingCredits);
    const neededFromRemaining = neededTotal - currentQualityPoints;
    const requiredAvg = neededFromRemaining / remainingCredits;
    return requiredAvg;
  }

  function feasibility(requiredAvg) {
    if (requiredAvg == null) return 'unknown';
    if (requiredAvg <= 0) return 'already-met';
    if (requiredAvg > 4.00 + 1e-9) return 'impossible';
    return 'possible';
  }

  window.PeekGrades = {
    GRADE_SCALE,
    NON_GPA_GRADES,
    pointForLetter,
    letterForPoint,
    parseCourse,
    summarize,
    whatIf,
    requiredAveragePoint,
    feasibility,
  };
})();
