/**
 * Turns a raw constituency record (from output/uk_constituencies.json) into an
 * indexable document.
 *
 * Two representations, used for two different purposes:
 *   - `text`: a short (3-4 sentence) natural-language summary, used ONLY as the
 *     embedding input. Embedding the full raw JSON was tried first (no
 *     post-processing, one chunk = one object) but measurably hurt retrieval --
 *     see uk-parliament-project/README.md's "Data cleaning" section. The
 *     embedding model is trained on English sentences, not JSON syntax, and
 *     every record shared identical structural tokens ("latestParty",
 *     "electionTitle", ...) that ate into the fixed token budget without
 *     differentiating anything.
 *   - `json`: the full cleaned record, unmodified. Still what gets stored and
 *     returned on search/citation (see vectorStore.js) -- nothing is lost from
 *     what a caller can retrieve, only what gets embedded changes.
 */

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function buildDocumentText(entry) {
  const sentences = [];

  if (entry.location) {
    sentences.push(entry.location.trim());
  }

  const member = entry.overview?.currentRepresentation?.member?.value;
  const memberStart = member?.latestHouseMembership?.membershipStartDate;

  const [latestElection] = entry.election_history || [];
  if (latestElection) {
    const parts = [`In the ${latestElection.electionTitle}, the result was ${latestElection.result}`];
    if (latestElection.majority != null) {
      parts.push(`with a majority of ${latestElection.majority}`);
    }
    if (latestElection.electorate != null && latestElection.turnout != null) {
      parts.push(`out of an electorate of ${latestElection.electorate} (turnout ${latestElection.turnout})`);
    }
    sentences.push(parts.join(", ") + ".");

    if (latestElection.isGeneralElection === false) {
      sentences.push("This result came from a by-election rather than a general election.");
    }

    if (member?.nameFullTitle && memberStart && memberStart !== latestElection.electionDate) {
      sentences.push(
        `${member.nameFullTitle} has been a Member of Parliament since ${formatDate(memberStart)}, before representing this constituency.`
      );
    }
  }

  return sentences.join(" ");
}

export function buildDocument(entry) {
  return {
    id: String(entry.id),
    name: entry.name,
    text: buildDocumentText(entry),
    json: JSON.stringify(entry),
  };
}
