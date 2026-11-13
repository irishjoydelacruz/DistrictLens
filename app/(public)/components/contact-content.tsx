"use client";

import {
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { Icon } from "./icons";
import { useSubmitReport } from "./submit-report-provider";

const officialWebsite = "https://www.tanzawaterdistrict.com";
const officialFacebook = "https://www.facebook.com/tanzawaterdistrict/";

const phoneNumbers = [
  { label: "(046) 484 1813", href: "tel:+63464841813" },
  { label: "(046) 505 2906", href: "tel:+63465052906" },
];

type FaqAction = "submit" | "track";

type Faq = {
  question: string;
  answer: string;
  // `keywords` are only used by the search (to match everyday words people
  // type). They are never shown on the page.
  keywords: string;
  // Buttons shown under the answer.
  actions?: FaqAction[];
};

const faqs: Faq[] = [
  {
    question: "What is DistrictLens?",
    answer:
      "DistrictLens is a public-facing portal for viewing water-service incident information and updates made available for Tanza. This version is a prototype and includes sample incident records, which may not reflect current service conditions.",
    keywords: "districtlens about portal prototype sample data records",
  },
  {
    question: "How do I submit a report?",
    answer:
      "Select Submit a Report below, or use the Submit Report button at the top of the page. Enter your name and contact number, choose your barangay and the type of problem, add an address or landmark if you can, describe what is happening, then select Send Report. You will receive a tracking number, so keep it. For urgent concerns, you can also use the contact details at the top of this page.",
    keywords:
      "submit send file report complaint complain problem leak leakage no water rupture low pressure how hotline contact",
    actions: ["submit"],
  },
  {
    question: "How do I track my report?",
    answer:
      "Select Track a Report and enter the tracking number you received after submitting, for example CR-1A2B3C4D, then select Check Status. Your report will show as Pending review, Verified, or Not accepted. If it was not accepted, the reason is shown.",
    keywords:
      "track tracking number check status follow up verified rejected pending report where is my report",
    actions: ["track"],
  },
  {
    question: "How can I check water service updates in my barangay?",
    answer:
      "Open the Public Map to search for or select a barangay and see the information available for it. You can also review published records in Incident History.",
    keywords:
      "check status updates barangay search select map history area",
  },
  {
    question: "What do Active, Monitoring, and Normal mean?",
    answer:
      "Active means an incident is shown as currently active. Monitoring means the reported condition is being monitored. Normal means no active service incident is currently shown for that area.",
    keywords:
      "status meaning legend active monitoring normal red yellow green color",
  },
  {
    question: "Does DistrictLens cover every barangay in Tanza?",
    answer:
      "The Public Map shows barangay boundaries from the included Tanza map data. Incident records depend on the information available for public viewing.",
    keywords: "coverage cover all barangays boundaries tanza records data",
  },
  {
    question: "Does DistrictLens provide real-time updates?",
    answer:
      "Information depends on records made available for public viewing and may change when records are updated. The portal does not claim live synchronization with Tanza Water District systems.",
    keywords: "real time live realtime update refresh sync current latest",
  },
  {
    question: "Can I receive alerts for my barangay?",
    answer:
      "If Web Push is available, choose a barangay and allow notifications in your browser. Availability and delivery depend on the portal's configured alert service.",
    keywords: "alerts notifications notify subscribe push web browser",
  },
  {
    question: "Where can I find the estimated restoration time?",
    answer:
      "When an estimate is available, it appears in the incident card on the Public Map and in the incident details in Incident History.",
    keywords: "restoration restore eta estimated time when water back return fix",
  },
];

/* -------------------------
   FAQ SEARCH
   Plain keyword matching on the FAQ text above. No server, no AI.
------------------------- */

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "do", "does", "did",
  "i", "me", "my", "we", "our", "you", "your", "it", "its", "of", "to",
  "in", "on", "at", "for", "from", "by", "and", "or", "can", "could",
  "how", "what", "where", "when", "which", "who", "why", "there", "this",
  "that", "with", "about", "any", "have", "has", "get", "want", "need",
  "please", "tell",
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

// "alert" matches "alerts", "restor" matches "restoration", etc.
function wordMatches(word: string, token: string) {
  return (
    word === token ||
    (token.length >= 3 && word.startsWith(token)) ||
    (word.length >= 4 && token.startsWith(word))
  );
}

const indexedFaqs = faqs.map((faq) => ({
  ...faq,
  normalizedQuestion: normalize(faq.question),
  questionWords: tokenize(faq.question),
  answerWords: tokenize(faq.answer),
  keywordWords: tokenize(faq.keywords),
  // Every word, stop words included, for matching a half-typed word
  allQuestionWords: normalize(faq.question).split(" "),
  allAnswerWords: normalize(faq.answer).split(" "),
}));

// How many matching questions the list shows
const MAX_SUGGESTIONS = 5;

function searchFaqs(query: string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) return [];

  const tokens = tokenize(query);

  // The word being typed right now (no space after it yet). Even one letter
  // counts, so results show up from the very first keystroke.
  const lastWord = normalizedQuery.split(" ").pop() ?? "";
  const stillTyping = !/\s$/.test(query);
  const partial =
    stillTyping && (lastWord.length < 3 || STOP_WORDS.has(lastWord))
      ? lastWord
      : "";

  const scored = indexedFaqs
    .map((faq) => {
      let score = 0;

      // Someone picked or typed the whole question
      if (faq.normalizedQuestion === normalizedQuery) score += 100;

      tokens.forEach((token) => {
        if (
          faq.questionWords.some((word) => wordMatches(word, token)) ||
          faq.keywordWords.some((word) => wordMatches(word, token))
        ) {
          score += 3;
        } else if (
          faq.answerWords.some((word) => wordMatches(word, token))
        ) {
          score += 1;
        }
      });

      if (partial) {
        if (
          faq.allQuestionWords.some((word) => word.startsWith(partial)) ||
          faq.keywordWords.some((word) => word.startsWith(partial))
        ) {
          score += 3;
        } else if (
          faq.allAnswerWords.some((word) => word.startsWith(partial))
        ) {
          score += 1;
        }
      }

      return { faq, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_SUGGESTIONS).map((item) => item.faq);
}

// Shared styles (same look as the Dashboard, Analytics, and About pages).
// The "!" on rounded-none overrides the portal CSS that rounds every button.
const smallButtonClass =
  "inline-flex w-fit items-center gap-2 rounded-none! border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#123D73] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

const smallPrimaryButtonClass =
  "inline-flex w-fit items-center gap-2 rounded-none! bg-[#123D73] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0D2F59] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30";

// Same red as the Submit Report button in the header.
const smallReportButtonClass =
  "inline-flex w-fit items-center gap-2 rounded-none! bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600/30";

const primaryButtonClass =
  "rounded-none! bg-[#123D73] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#0D2F59] focus:outline-none focus:ring-2 focus:ring-[#123D73]/30";

const secondaryButtonClass =
  "rounded-none! border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#123D73]/20";

const detailRowClass =
  "grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-6";

function IconTile({ name }: { name: ComponentProps<typeof Icon>["name"] }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center border border-blue-100 bg-blue-50 text-[#123D73]"
    >
      <Icon name={name} className="size-5" />
    </span>
  );
}

function Panel({
  headingId,
  eyebrow,
  title,
  description,
  children,
}: {
  headingId: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 overflow-hidden border border-slate-300 bg-white"
    >
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {eyebrow}
        </p>

        <h2 id={headingId} className="mt-1 text-lg font-bold text-[#123D73]">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {children}
    </section>
  );
}

type ContactContentProps = {
  onNavigate: (section: "map" | "history") => void;
};

export default function ContactContent({ onNavigate }: ContactContentProps) {
  const { openSubmitReport, openTrackReport } = useSubmitReport();

  const [query, setQuery] = useState("");
  // The question the person clicked. Its answer is shown only after this.
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const matches = useMemo(() => searchFaqs(query), [query]);

  const selectedFaq =
    faqs.find((faq) => faq.question === selectedQuestion) ?? null;

  const noMatch = hasQuery && matches.length === 0 && !selectedFaq;

  // Nothing typed (or nothing found): offer every question.
  // Otherwise: only the questions that match what was typed.
  const showAllQuestions = !hasQuery || noMatch;
  const listItems = showAllQuestions ? faqs : matches;

  function chooseQuestion(faq: Faq) {
    setSelectedQuestion(faq.question);
    setQuery(faq.question);
    setActiveIndex(-1);
  }

  function clearSearch() {
    setQuery("");
    setSelectedQuestion(null);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      clearSearch();
      return;
    }

    if (selectedFaq) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, listItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const pick = listItems[activeIndex >= 0 ? activeIndex : 0];

      if (pick && (activeIndex >= 0 || hasQuery)) {
        event.preventDefault();
        chooseQuestion(pick);
      }
    }
  }

  return (
    <main id="main-content" className="flex-1 bg-[#F4F6F9]">
      <div className="w-full px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
        <div className="space-y-5 border border-[#4438A8] bg-white p-4 text-slate-900 sm:p-5">
          {/* PAGE BANNER */}
          <header className="border border-[#4438A8] bg-linear-to-r from-[#241C70] via-[#342992] to-[#5366C8] px-5 py-5 sm:px-6">
            <p className="text-sm font-bold text-indigo-100">
              Contact and assistance
            </p>

            <h1 className="mt-2 text-2xl font-bold text-white">
              We&apos;re Here to Help
            </h1>

            <p className="mt-2 max-w-3xl text-base text-indigo-100">
              Contact Tanza Water District for inquiries and assistance, or
              submit a report about a water service problem. Find the contact
              details and official channels below.
            </p>
          </header>

          {/* CONTACT INFORMATION */}
          <Panel
            headingId="contact-details-heading"
            eyebrow="Get in touch"
            title="Contact Information"
          >
            <div className="divide-y divide-slate-200">
              <div className={detailRowClass}>
                <div className="flex items-center gap-3 text-base font-semibold text-slate-800">
                  <Icon name="phone" className="size-5 text-[#123D73]" />
                  <span>Telephone</span>
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-2 text-base font-semibold text-[#123D73]">
                  {phoneNumbers.map((phone) => (
                    <a
                      key={phone.href}
                      className="contact-detail-link"
                      href={phone.href}
                    >
                      {phone.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className={detailRowClass}>
                <div className="flex items-center gap-3 text-base font-semibold text-slate-800">
                  <Icon name="mail" className="size-5 text-[#123D73]" />
                  <span>Email</span>
                </div>

                <a
                  className="contact-detail-link break-all text-base font-semibold text-[#123D73]"
                  href="mailto:tanza_wd@yahoo.com"
                >
                  tanza_wd@yahoo.com
                </a>
              </div>

              <div className={detailRowClass}>
                <div className="flex items-center gap-3 text-base font-semibold text-slate-800">
                  <Icon name="globe" className="size-5 text-[#123D73]" />
                  <span>Official Website</span>
                </div>

                <a
                  className="contact-detail-link break-all text-base font-semibold text-[#123D73]"
                  href={officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.tanzawaterdistrict.com
                </a>
              </div>
            </div>
          </Panel>

          {/* SUBMIT / TRACK A REPORT */}
          <Panel
            headingId="report-heading"
            eyebrow="Report a problem"
            title="Submit or Track a Report"
            description="Tell Tanza Water District about a water service problem in your area. Staff review each report before it is acted on."
          >
            <div className="divide-y divide-slate-200 md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
              <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <IconTile name="map-pin" />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    Submit a Report
                  </h3>
                  <p className="mt-1 text-base leading-7 text-slate-600">
                    Report a leak, low water pressure, no water supply, or
                    another water service problem. You will receive a tracking
                    number.
                  </p>
                  <button
                    type="button"
                    onClick={openSubmitReport}
                    aria-haspopup="dialog"
                    aria-controls="submit-report-modal"
                    className={`${smallReportButtonClass} mt-3`}
                  >
                    Submit a Report
                  </button>
                </div>
              </article>

              <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <IconTile name="history" />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    Track a Report
                  </h3>
                  <p className="mt-1 text-base leading-7 text-slate-600">
                    Already sent a report? Enter your tracking number to see
                    whether it is pending, verified, or not accepted.
                  </p>
                  <button
                    type="button"
                    onClick={openTrackReport}
                    aria-haspopup="dialog"
                    aria-controls="submit-report-modal"
                    className={`${smallButtonClass} mt-3`}
                  >
                    Track a Report
                  </button>
                </div>
              </article>
            </div>
          </Panel>

          {/* OFFICIAL CHANNELS */}
          <Panel
            headingId="official-channels-heading"
            eyebrow="Connect with TWD"
            title="Official TWD Channels"
          >
            <div className="divide-y divide-slate-200 md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
              <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <IconTile name="globe" />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    Tanza Water District Website
                  </h3>
                  <p className="mt-1 text-base leading-7 text-slate-600">
                    Visit the website for published information and
                    announcements.
                  </p>
                  <a
                    className={`${smallButtonClass} mt-3`}
                    href={officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit Website
                    <Icon name="external" className="size-4" />
                  </a>
                </div>
              </article>

              <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <IconTile name="facebook" />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    Tanza Water District Facebook Page
                  </h3>
                  <p className="mt-1 text-base leading-7 text-slate-600">
                    Visit the Facebook page for published posts and
                    announcements.
                  </p>
                  <a
                    className={`${smallButtonClass} mt-3`}
                    href={officialFacebook}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit Facebook Page
                    <Icon name="external" className="size-4" />
                  </a>
                </div>
              </article>
            </div>
          </Panel>

          {/* OFFICE INFORMATION */}
          <Panel
            headingId="office-info-heading"
            eyebrow="Plan your visit"
            title="Office Location & Business Hours"
          >
            <div className="divide-y divide-slate-200 md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
              <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <IconTile name="map-pin" />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    Office Location
                  </h3>
                  <address className="mt-1 text-base not-italic leading-7 text-slate-600">
                    A. Soriano Highway, Tanza, Cavite
                  </address>
                </div>
              </article>

              <article className="flex items-start gap-4 px-5 py-5 sm:px-6">
                <IconTile name="clock" />

                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-800">
                    Business Hours
                  </h3>
                  <p className="mt-1 text-base leading-7 text-slate-600">
                    Monday to Friday, 8:00 AM to 5:00 PM
                  </p>
                </div>
              </article>
            </div>
          </Panel>

          {/* FAQ — search */}
          <Panel
            headingId="faq-heading"
            eyebrow="Help and information"
            title="Frequently Asked Questions"
            description="Start typing, then pick a question from the list to see the answer."
          >
            <div className="px-5 py-5 sm:px-6">
              {/* Search box: Clear sits inside the input, on the right */}
              <div className="relative">
                <label htmlFor="faq-search" className="sr-only">
                  Search the frequently asked questions
                </label>

                <input
                  id="faq-search"
                  type="search"
                  role="combobox"
                  aria-expanded={!selectedFaq}
                  aria-controls="faq-suggestions"
                  aria-autocomplete="list"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedQuestion(null);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question, e.g. How do I submit a report?"
                  autoComplete="off"
                  className="block w-full min-w-0 rounded-none! border border-slate-300 bg-white py-3 pl-4 pr-24 text-base text-slate-800 placeholder:text-slate-400 focus:border-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20 [&::-webkit-search-cancel-button]:appearance-none"
                />

                {(hasQuery || selectedFaq) && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-none! px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#123D73] focus:outline-none focus:ring-2 focus:ring-[#123D73]/20"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Answer: only after a question was clicked */}
              <div aria-live="polite">
                {selectedFaq && (
                  <article className="mt-5 border border-slate-300 border-l-4 border-l-[#123D73] bg-white px-5 py-4">
                    <h3 className="text-base font-semibold text-[#123D73]">
                      {selectedFaq.question}
                    </h3>
                    <p className="mt-2 text-base leading-7 text-slate-600">
                      {selectedFaq.answer}
                    </p>

                    {selectedFaq.actions && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {selectedFaq.actions.includes("submit") && (
                          <button
                            type="button"
                            onClick={openSubmitReport}
                            aria-haspopup="dialog"
                            aria-controls="submit-report-modal"
                            className={smallReportButtonClass}
                          >
                            Submit a Report
                          </button>
                        )}

                        {selectedFaq.actions.includes("track") && (
                          <button
                            type="button"
                            onClick={openTrackReport}
                            aria-haspopup="dialog"
                            aria-controls="submit-report-modal"
                            className={smallPrimaryButtonClass}
                          >
                            Track a Report
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                )}

                {noMatch && (
                  <div className="mt-5 border border-slate-300 bg-slate-50 px-5 py-4">
                    <p className="text-base font-semibold text-slate-800">
                      No question found for &ldquo;{trimmedQuery}&rdquo;
                    </p>
                    <p className="mt-2 text-base leading-7 text-slate-600">
                      Try different words, or pick one of the questions
                      below. You can also use the contact details at the top
                      of this page.
                    </p>
                  </div>
                )}
              </div>

              {/* Question list: matches while typing, all questions when empty */}
              {!selectedFaq && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-500">
                    {showAllQuestions
                      ? "Suggested questions"
                      : "Matching questions"}
                  </p>

                  <ul
                    id="faq-suggestions"
                    role="listbox"
                    aria-label="Questions"
                    className="mt-3 divide-y divide-slate-200 border border-slate-300"
                  >
                    {listItems.map((faq, index) => {
                      const active = index === activeIndex;

                      return (
                        <li
                          key={faq.question}
                          role="option"
                          aria-selected={active}
                        >
                          <button
                            type="button"
                            onClick={() => chooseQuestion(faq)}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`flex w-full items-center rounded-none! px-4 py-3 text-left text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${
                              active ? "bg-slate-50 text-[#123D73]" : "bg-white"
                            }`}
                          >
                            {faq.question}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </Panel>

          {/* EXPLORE */}
          <section
            className="flex flex-col gap-3 sm:flex-row"
            aria-label="Explore the public portal"
          >
            <button
              type="button"
              onClick={() => onNavigate("map")}
              className={primaryButtonClass}
            >
              View Public Map
            </button>

            <button
              type="button"
              onClick={() => onNavigate("history")}
              className={secondaryButtonClass}
            >
              View Incident History
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}