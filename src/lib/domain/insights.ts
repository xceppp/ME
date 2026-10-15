export type InsightDay = {
  date: string;
  peace: number | null;
  confidence: number | null;
  reflected: boolean;
  habitCompletion: number | null;
};

export type Insight = {
  id: string;
  text: string;
};

const MIN_GROUP = 3;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function compareGroups(
  id: string,
  label: string,
  withValues: number[],
  withoutValues: number[],
): Insight | null {
  if (withValues.length < MIN_GROUP || withoutValues.length < MIN_GROUP) return null;
  const withAvg = average(withValues);
  const withoutAvg = average(withoutValues);
  if (withAvg === null || withoutAvg === null || withAvg === withoutAvg) return null;
  const relation = withAvg > withoutAvg ? "higher" : "lower";
  return {
    id,
    text: `Your recorded ${label} ratings were ${relation} on these days (${withAvg}) than on the comparison days (${withoutAvg}). This is a description of your records, not a cause.`,
  };
}

export function buildInsights(days: InsightDay[]): Insight[] {
  const reflectedPeace = days.filter((day) => day.reflected && day.peace !== null).map((day) => day.peace!);
  const unreflectedPeace = days.filter((day) => !day.reflected && day.peace !== null).map((day) => day.peace!);
  const activePeace = days.filter((day) => (day.habitCompletion ?? -1) >= 70 && day.peace !== null).map((day) => day.peace!);
  const quietPeace = days.filter((day) => day.habitCompletion !== null && day.habitCompletion < 70 && day.peace !== null).map((day) => day.peace!);
  const reflectedConfidence = days.filter((day) => day.reflected && day.confidence !== null).map((day) => day.confidence!);
  const unreflectedConfidence = days.filter((day) => !day.reflected && day.confidence !== null).map((day) => day.confidence!);

  const insights = [
    compareGroups(
      "peace-reflection",
      "peace",
      reflectedPeace,
      unreflectedPeace,
    ),
    compareGroups(
      "peace-habits",
      "peace",
      activePeace,
      quietPeace,
    ),
    compareGroups(
      "confidence-reflection",
      "confidence",
      reflectedConfidence,
      unreflectedConfidence,
    ),
  ].filter((item): item is Insight => item !== null);

  if (insights.length === 0) {
    return [{ id: "insufficient", text: "Keep recording your days to unlock meaningful insights." }];
  }

  return insights.map((insight) => {
    if (insight.id === "peace-reflection") {
      return {
        ...insight,
        text: insight.text.replace(
          "on these days",
          "on days when you completed your evening reflection",
        ).replace("on the comparison days", "on days without one"),
      };
    }
    if (insight.id === "peace-habits") {
      return {
        ...insight,
        text: insight.text
          .replace("on these days", "on days when at least 70% of eligible habits were completed")
          .replace("on the comparison days", "on days below that level"),
      };
    }
    return {
      ...insight,
      text: insight.text
        .replace("on these days", "on days when you completed your evening reflection")
        .replace("on the comparison days", "on days without one"),
    };
  });
}
