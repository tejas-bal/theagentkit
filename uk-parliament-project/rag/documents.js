/**
 * Turns a raw constituency record (from output/uk_constituencies.json) into a single
 * retrievable text document, plus lightweight metadata for citing sources.
 */

function getMember(entry) {
  const overview = entry.overview || {};
  const rep = (overview.currentRepresentation || {}).member || {};
  return rep.value || {};
}

export function buildDocumentText(entry) {
  const name = entry.name || "Unknown constituency";
  const member = getMember(entry);
  const mpName = member.nameFullTitle || member.nameDisplayAs;
  const party = (member.latestParty || {}).name;

  const lines = [`Constituency: ${name}.`];

  if (mpName) {
    lines.push(`Current MP: ${mpName}${party ? ` (${party}).` : "."}`);
  }

  if (entry.location) {
    lines.push(entry.location);
  }

  for (const result of entry.election_history || []) {
    const title = result.electionTitle || "an election";
    const outcome = result.result;
    const winningParty = (result.winningParty || {}).name;

    const parts = [
      outcome ? `In the ${title}, the result was ${outcome}` : `Result of the ${title}`,
    ];
    if (winningParty) parts.push(`won by ${winningParty}`);
    if (result.electorate != null) parts.push(`electorate ${result.electorate}`);
    if (result.turnout != null) parts.push(`turnout ${result.turnout}`);
    if (result.majority != null) parts.push(`majority ${result.majority}`);

    lines.push(parts.join(", ") + ".");
  }

  return lines.join(" ");
}

export function buildDocument(entry) {
  return {
    id: entry.id,
    name: entry.name,
    text: buildDocumentText(entry),
  };
}
