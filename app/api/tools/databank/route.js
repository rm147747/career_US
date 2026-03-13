import { NextResponse } from 'next/server';

const MAX_RESULTS = 5;

/**
 * Queries public databanks: PubMed, ClinicalTrials.gov, Wikipedia.
 */
export async function POST(request) {
  try {
    const { query, source } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query não fornecida.' }, { status: 400 });
    }

    const src = (source || 'pubmed').toLowerCase();

    switch (src) {
      case 'pubmed':
        return NextResponse.json(await searchPubMed(query));
      case 'clinicaltrials':
        return NextResponse.json(await searchClinicalTrials(query));
      case 'wikipedia':
        return NextResponse.json(await searchWikipedia(query));
      default:
        return NextResponse.json({ error: `Fonte "${src}" não suportada. Use: pubmed, clinicaltrials, wikipedia.` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro na consulta.' }, { status: 500 });
  }
}

async function searchPubMed(query) {
  // Step 1: Search for IDs
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${MAX_RESULTS}&retmode=json`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) });
  const searchData = await searchRes.json();
  const ids = searchData?.esearchresult?.idlist || [];

  if (ids.length === 0) {
    return { source: 'pubmed', query, results: [], message: 'Nenhum resultado encontrado.' };
  }

  // Step 2: Fetch summaries
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(15000) });
  const summaryData = await summaryRes.json();

  const results = ids.map((id) => {
    const article = summaryData?.result?.[id];
    if (!article) return null;
    return {
      id,
      title: article.title || '',
      authors: (article.authors || []).map((a) => a.name).join(', '),
      journal: article.fulljournalname || article.source || '',
      date: article.pubdate || '',
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  }).filter(Boolean);

  return { source: 'pubmed', query, results, total: searchData?.esearchresult?.count };
}

async function searchClinicalTrials(query) {
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=${MAX_RESULTS}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();

  const studies = (data?.studies || []).map((study) => {
    const proto = study?.protocolSection;
    const id = proto?.identificationModule;
    const status = proto?.statusModule;
    const desc = proto?.descriptionModule;
    return {
      nctId: id?.nctId || '',
      title: id?.briefTitle || '',
      status: status?.overallStatus || '',
      phase: (proto?.designModule?.phases || []).join(', ') || 'N/A',
      summary: (desc?.briefSummary || '').slice(0, 500),
      url: `https://clinicaltrials.gov/study/${id?.nctId || ''}`,
    };
  });

  return { source: 'clinicaltrials', query, results: studies, total: data?.totalCount };
}

async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (res.status === 404) {
    // Fallback: search
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${MAX_RESULTS}&format=json`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    const searchData = await searchRes.json();
    const results = (searchData?.query?.search || []).map((r) => ({
      title: r.title,
      snippet: r.snippet.replace(/<[^>]+>/g, ''),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    }));
    return { source: 'wikipedia', query, results };
  }

  const data = await res.json();
  return {
    source: 'wikipedia',
    query,
    results: [{
      title: data.title || '',
      extract: data.extract || '',
      url: data.content_urls?.desktop?.page || '',
    }],
  };
}
