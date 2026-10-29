'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
    Zap,
    Check,
    X,
    Sparkles,
    ImageIcon,
    Search,
    Info,
    Code,
    ChevronDown,
    Loader2,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { toast } from 'sonner';

// Scenario data
const scenarios = {
    bad: {
        alt: "",
        displayAlt: '""',
        fileName: "red-fox.png",
        srText: "The image is skipped because its alt attribute is empty.",
        googleKeywords: ["image", "png", "file", "unknown"],
        confidence: 15,
        confidenceLabel: "Low context",
        explanation: "An empty alt attribute tells assistive technology to treat the image as decorative. Search systems receive little useful text beyond the filename and surrounding page content."
    },
    good: {
        alt: "Red fox standing on a sandy beach beside calm ocean waves at sunset.",
        displayAlt: '"Red fox standing on a sandy beach beside calm ocean waves at sunset."',
        fileName: "red-fox.png",
        srText: "Image. Red fox standing on a sandy beach beside calm ocean waves at sunset.",
        googleKeywords: ["red fox", "beach", "ocean", "waves", "sunset"],
        confidence: 95,
        confidenceLabel: "Useful context",
        explanation: "Descriptive alt text gives screen-reader users the image's relevant meaning and gives search systems clearer text context. It should still be reviewed against the surrounding page."
    }
};

export default function AltTextSimulatorPage() {
    const [currentScenario, setCurrentScenario] = useState<'bad' | 'good'>('bad');
    const [isBroken, setIsBroken] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const data = scenarios[currentScenario];

    const handleScenarioChange = (type: 'bad' | 'good') => {
        setCurrentScenario(type);
        // Trigger scanning animation
        setIsScanning(true);
        setTimeout(() => setIsScanning(false), 2000);
    };

    const toggleBrokenImage = () => {
        setIsBroken(!isBroken);
    };

    const speakAltText = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const textToSpeak = data.srText;
            const utterance = new SpeechSynthesisUtterance(textToSpeak);

            setIsSpeaking(true);

            utterance.onend = function () {
                setIsSpeaking(false);
            };

            window.speechSynthesis.speak(utterance);
        } else {
            toast.error("Text-to-speech is not supported on this device.");
        }
    };

    return (
        <div className="min-h-screen bg-white text-ink font-sans selection:bg-yellow-tint">
            <Navbar />

            {/* Header Section */}
            <header className="bg-white/40 backdrop-blur-xl border-b border-line sticky top-0 z-30 shadow-notebook md:static md:bg-transparent md:border-0 md:shadow-none md:pt-16 md:mb-12">
                <div className="max-w-6xl mx-auto px-6 py-6 md:py-0 text-center md:text-left">
                    <div className="inline-flex h-8 items-center gap-2 px-3 rounded-full bg-yellow-soft mb-4">
                        <Sparkles className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                        <span className="text-xs font-semibold text-ink uppercase tracking-[0.06em]">Try it</span>
                    </div>
                    <h1 className="text-3xl md:text-6xl font-bold text-ink leading-tight font-outfit tracking-tight">
                        Alt Text <span className="text-ink italic">Simulator.</span>
                    </h1>
                    <p className="text-sm md:text-xl text-ink-muted mt-4 max-w-2xl font-normal">Switch between an image with no alt text and one with a clear description. Hear what a screen reader says, and see what text search engines get.</p>
                </div>
            </header>

            <main className="px-4 md:px-6 max-w-6xl mx-auto space-y-4 md:space-y-6 mt-4 md:mt-0 pb-12">

                {/* Controls Section */}
                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-notebook border border-line">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-10 justify-between items-center">

                        {/* Scenario Toggle */}
                        <div className="w-full md:w-auto">
                            <span className="label-caps mb-3 block">Choose a Version</span>
                            <div className="flex bg-yellow-tint p-1 rounded-xl w-full md:w-auto border border-line">
                                <button
                                    type="button"
                                    onClick={() => handleScenarioChange('bad')}
                                    aria-pressed={currentScenario === 'bad'}
                                    className={`flex-1 md:flex-none h-11 px-5 rounded-lg text-[15px] font-semibold transition-colors duration-300 flex items-center justify-center gap-2 ${currentScenario === 'bad'
                                        ? 'bg-brand-yellow text-ink'
                                        : 'text-ink-muted hover:text-ink'
                                        }`}
                                >
                                    <X className="h-4 w-4" />
                                    <span>No Alt Text</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleScenarioChange('good')}
                                    aria-pressed={currentScenario === 'good'}
                                    className={`flex-1 md:flex-none h-11 px-5 rounded-lg text-[15px] font-semibold transition-colors duration-300 flex items-center justify-center gap-2 ${currentScenario === 'good'
                                        ? 'bg-brand-yellow text-ink'
                                        : 'text-ink-muted hover:text-ink'
                                        }`}
                                >
                                    <Check className="h-4 w-4" />
                                    <span>With Alt Text</span>
                                </button>
                            </div>
                        </div>

                        {/* Broken Image Toggle */}
                        <div className="w-full md:w-auto pt-6 md:pt-0 border-t md:border-t-0 border-line">
                            <label className="flex items-center justify-between md:justify-start cursor-pointer group">
                                <span className="text-sm font-semibold text-ink mr-4">Broken Image State</span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isBroken}
                                        onChange={toggleBrokenImage}
                                        aria-label="Show the broken image state"
                                    />
                                    <div className="w-12 h-7 bg-yellow-tint border border-line-strong rounded-full peer peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-yellow-strong peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:ring-1 after:ring-line-strong after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-yellow peer-checked:border-yellow-strong"></div>
                                </div>
                            </label>
                        </div>

                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

                    {/* 1. The Browser View */}
                    <div className="bg-white rounded-2xl shadow-notebook border border-line overflow-hidden flex flex-col transition-all duration-500 hover:border-line-strong group">
                        <div className="bg-yellow-tint px-6 py-4 border-b border-line flex items-center justify-between gap-3">
                            <h2 className="font-semibold text-ink text-sm uppercase tracking-[0.06em] flex items-center gap-3">
                                <span className="w-2 h-2 shrink-0 rounded-full bg-yellow-strong" aria-hidden="true" />
                                What Users See
                            </h2>
                            <span className="inline-flex h-7 items-center px-2.5 bg-yellow-soft text-ink rounded-lg text-xs font-semibold uppercase tracking-[0.06em]">Visual</span>
                        </div>
                        <div className="p-6 md:p-8 flex-grow flex items-center justify-center bg-white min-h-[300px]">
                            <div className="relative w-full max-w-sm aspect-video bg-white shadow-notebook rounded-2xl overflow-hidden border border-line flex items-center justify-center p-2">
                                <Image
                                    src="/red-fox.png"
                                    fill
                                    sizes="(min-width: 1024px) 384px, 100vw"
                                    className={`w-full h-full object-cover rounded-2xl transition-opacity duration-700 ${isBroken ? 'opacity-0' : 'opacity-100'}`}
                                    alt={data.alt}
                                />

                                {/* Broken Image State */}
                                {isBroken && (
                                    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                                        <ImageIcon className="h-10 w-10 text-ink-muted mb-4" aria-hidden="true" />
                                        <p className="label-caps mb-4">{data.fileName}</p>
                                        <div className="text-sm font-normal text-ink-muted border border-line p-5 rounded-2xl bg-white w-full italic shadow-inner">
                                            {data.alt || data.fileName}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. The Code View */}
                    <div className="bg-white rounded-2xl shadow-notebook border border-line overflow-hidden flex flex-col transition-all duration-500 hover:border-line-strong">
                        <div className="bg-yellow-tint px-6 py-4 border-b border-line flex items-center justify-between gap-3">
                            <h2 className="font-semibold text-ink text-sm uppercase tracking-[0.06em] flex items-center gap-3">
                                <span className="w-2 h-2 shrink-0 rounded-full bg-yellow-strong" aria-hidden="true" />
                                Website Code (HTML)
                            </h2>
                            <span className="inline-flex h-7 items-center px-2.5 bg-yellow-soft text-ink rounded-lg text-xs font-semibold uppercase tracking-[0.06em]">Code</span>
                        </div>
                        <div className="p-6 md:p-8 font-mono text-sm md:text-base relative flex-grow flex items-center overflow-x-auto bg-yellow-tint">
                            <div className="text-ink w-full whitespace-pre-wrap leading-relaxed">
                                <span className="text-ink font-bold">&lt;img</span>{' '}
                                <span className="text-ink-muted">src</span>=<span className="text-ink">&quot;red-fox.png&quot;</span>
                                {'\n  '}
                                <span className="text-ink-muted">alt</span>=<span className="text-ink bg-yellow-soft rounded-lg transition-all duration-700 inline-block px-3 py-1.5 border border-line-strong">{data.displayAlt}</span>
                                <span className="text-ink font-bold">&gt;</span>
                            </div>
                                                    </div>
                    </div>

                    {/* 3. Google Bot View */}
                    <div className="bg-white rounded-2xl shadow-notebook border border-line overflow-hidden flex flex-col transition-all duration-500 hover:border-line-strong">
                        <div className="bg-yellow-tint px-6 py-4 border-b border-line flex items-center justify-between gap-3">
                            <h2 className="font-semibold text-ink text-sm uppercase tracking-[0.06em] flex items-center gap-3">
                                <span className="w-2 h-2 shrink-0 rounded-full bg-yellow-strong" aria-hidden="true" />
                                Search Crawler View
                            </h2>
                            <span className="inline-flex h-7 items-center px-2.5 bg-yellow-soft text-ink rounded-lg text-xs font-semibold uppercase tracking-[0.06em]">SEO</span>
                        </div>
                        <div className="p-6 md:p-8 relative bg-white">
                            {/* Scanning effect */}
                            {isScanning && (
                                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl">
                                    <div className="scan-line"></div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="w-16 h-16 bg-white rounded-[1.25rem] border border-line flex items-center justify-center flex-shrink-0 self-center md:self-start shadow-notebook">
                                    <div className="relative">
                                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand-yellow animate-pulse"></div>
                                        <Search className="w-7 h-7 text-ink" />
                                    </div>
                                </div>
                                <div className="flex-grow w-full">
                                    <h3 className="label-caps mb-4">Keywords Found</h3>
                                    <div className="flex flex-wrap gap-2.5 mb-8">
                                        {data.googleKeywords.map((kw, index) => (
                                            <span
                                                key={index}
                                                className={`inline-flex h-8 items-center px-3 rounded-full text-xs font-semibold border transition-colors duration-500 ${currentScenario === 'good'
                                                    ? 'bg-yellow-soft text-ink border-transparent'
                                                    : 'bg-white text-ink-muted border-line'
                                                    }`}
                                            >
                                                {kw}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border border-line shadow-notebook transition-all duration-500">
                                        <div className="flex justify-between gap-3 mb-3 items-center">
                                            <span className="label-caps">Understanding Level</span>
                                            <span className="inline-flex h-7 items-center text-xs font-semibold text-ink bg-yellow-tint px-2.5 rounded-lg border border-line">Illustrative: {data.confidenceLabel}</span>
                                        </div>
                                        <progress
                                            className={`confidence-progress w-full bg-white rounded-full h-2.5 p-0.5 border border-line ${data.confidence > 50 ? 'confidence-high' : 'confidence-low'}`}
                                            value={data.confidence}
                                            max={100}
                                            aria-label="Illustrative understanding level"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Accessibility View */}
                    <div className="bg-white rounded-2xl shadow-notebook border border-line overflow-hidden flex flex-col transition-all duration-500 hover:border-line-strong">
                        <div className="bg-yellow-tint px-6 py-4 border-b border-line flex items-center justify-between gap-3">
                            <h2 className="font-semibold text-ink text-sm uppercase tracking-[0.06em] flex items-center gap-3">
                                <span className="w-2 h-2 shrink-0 rounded-full bg-yellow-strong" aria-hidden="true" />
                                How Screen Readers Hear It
                            </h2>
                            <span className="inline-flex h-7 items-center px-2.5 bg-yellow-soft text-ink rounded-lg text-xs font-semibold uppercase tracking-[0.06em]">Audio</span>
                        </div>
                        <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center">

                            {/* Waveform */}
                            <div className={`h-12 flex items-center justify-center gap-2 mb-8 w-full transition-opacity duration-500 ${isSpeaking ? 'opacity-100' : 'opacity-20'}`}>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                    <div
                                        key={i}
                                        className={`bar wave-delay-${i} ${isSpeaking ? 'speaking' : ''}`}
                                    ></div>
                                ))}
                            </div>

                            <div className="bg-yellow-tint text-ink font-outfit p-6 pb-10 rounded-2xl w-full mb-6 text-left min-h-[120px] relative border border-line">
                                <span className="label-caps absolute bottom-4 right-6">Rendered Output</span>
                                <span className="label-caps mr-3 !text-ink">Assistant:</span>
                                <span className="leading-relaxed text-ink text-lg font-normal italic">"{data.srText}"</span>
                            </div>

                            <button
                                type="button"
                                onClick={speakAltText}
                                className={`w-full ${buttonVariants()}`}
                            >
                                {isSpeaking ? (
                                    <>
                                        <Loader2 className="animate-spin" aria-hidden="true" />
                                        <span>Reading...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles aria-hidden="true" />
                                        <span>Hear the Difference</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                </div>

                {/* Impact Analysis */}
                <div className="mt-8 p-6 md:p-8 bg-white border border-line rounded-2xl text-ink mb-12 shadow-notebook relative overflow-hidden">
                    <h3 className="font-bold mb-6 flex items-center text-2xl text-ink gap-4 font-outfit">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-yellow-soft rounded-xl">
                            <Info className="h-6 w-6 text-ink" aria-hidden="true" />
                        </div>
                        Why It Matters
                    </h3>
                    <p className="text-lg leading-relaxed text-ink-muted max-w-4xl font-normal italic">
                        "{data.explanation}"
                    </p>
                </div>

                {/* INFOGRAPHIC SECTION */}
                <div className="mt-12 bg-white text-ink rounded-2xl overflow-hidden shadow-notebook border border-line mb-20 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-line-strong to-transparent"></div>

                    <div className="p-8 md:p-12 text-center border-b border-line">
                        <h2 className="text-3xl md:text-6xl font-bold mb-6 text-ink tracking-tight font-outfit">How Alt Text Works</h2>
                        <p className="text-ink-muted text-sm md:text-xl max-w-2xl mx-auto font-normal">From the code on your page to what visitors and search engines receive.</p>
                    </div>

                    <div className="p-8 md:p-12">
                        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-12 md:gap-4 relative">

                            {/* Step 1 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center group">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-brand-yellow rounded-2xl flex items-center justify-center mb-8 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3">
                                    <Code className="h-10 w-10 text-ink" aria-hidden="true" />
                                </div>
                                <h3 className="text-sm font-bold text-ink mb-4 font-outfit uppercase tracking-widest">01 Adding the Text</h3>
                                <p className="text-xs md:text-sm text-ink-muted leading-relaxed max-w-[240px] font-normal">
                                    The <code className="bg-white border border-line px-2 py-1 rounded-md text-ink font-bold font-mono text-xs">alt="description"</code> text is added directly to your image code.
                                </p>
                            </div>

                            {/* Arrow 1 */}
                            <div className="md:hidden">
                                <ChevronDown className="h-7 w-7 animate-bounce text-ink-muted" aria-hidden="true" />
                            </div>
                            <div className="hidden md:block absolute left-[32%] top-16 w-[12%] h-[2px] bg-line-strong"></div>

                            {/* Step 2 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center group">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-brand-yellow rounded-2xl flex items-center justify-center mb-8 transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                                    <Search className="h-10 w-10 text-ink" aria-hidden="true" />
                                </div>
                                <h3 className="text-sm font-bold text-ink mb-4 font-outfit uppercase tracking-widest">02 Search Engine Analysis</h3>
                                <p className="text-xs md:text-sm text-ink-muted leading-relaxed max-w-[240px] font-normal">
                                    Search engines can use the description as one source of text context for the image.
                                </p>
                            </div>

                            {/* Arrow 2 */}
                            <div className="md:hidden">
                                <ChevronDown className="h-7 w-7 animate-bounce text-ink-muted" aria-hidden="true" />
                            </div>
                            <div className="hidden md:block absolute right-[32%] top-16 w-[12%] h-[2px] bg-line-strong"></div>

                            {/* Step 3 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center group">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-brand-yellow rounded-2xl flex items-center justify-center mb-8 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 relative">
                                                                        <Zap className="h-10 w-10 text-ink" aria-hidden="true" />
                                </div>
                                <h3 className="text-sm font-bold text-ink mb-4 font-outfit uppercase tracking-widest">03 Better Experience</h3>
                                <p className="text-xs md:text-sm text-ink-muted leading-relaxed max-w-[240px] font-normal">
                                    Users who cannot see the image receive a useful description when the wording matches the page context.
                                </p>
                            </div>

                        </div>
                    </div>

                    <div className="bg-yellow-tint p-6 md:p-8 text-center text-sm text-ink-muted font-medium border-t border-line">
                        Clear descriptions help people who cannot see the image, and give search engines useful text too. Want drafts for your own images? See the{' '}
                        <Link href="/ai-alt-text-generator-for-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">AI alt text generator for WordPress</Link>.
                        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                            <Link href="/?auth=signup" className={buttonVariants()}>
                                Start with 150 free credits
                            </Link>
                            <a
                                href="https://wordpress.org/plugins/alt-text-pro/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={buttonVariants({ variant: 'secondary' })}
                            >
                                Install the WordPress plugin
                            </a>
                        </div>
                    </div>
                </div>

            </main>

            <Footer />


            <style jsx>{`
                .bar {
                    width: 6px;
                    background: #F2CF00;
                    margin: 0 3px;
                    border-radius: 999px;
                    animation: sound 0ms -800ms linear infinite alternate;
                    height: 10px;
                }

                .bar.speaking {
                    animation-duration: 400ms;
                }

                .wave-delay-0 { animation-delay: -1.2s; }
                .wave-delay-1 { animation-delay: -1.05s; }
                .wave-delay-2 { animation-delay: -0.9s; }
                .wave-delay-3 { animation-delay: -0.75s; }
                .wave-delay-4 { animation-delay: -0.6s; }
                .wave-delay-5 { animation-delay: -0.45s; }
                .wave-delay-6 { animation-delay: -0.3s; }
                .wave-delay-7 { animation-delay: -0.15s; }
                .wave-delay-8 { animation-delay: 0s; }

                @keyframes sound {
                    0% { opacity: .35; height: 10px; }
                    100% { opacity: 1; height: 40px; }
                }
                
                .scan-line {
                    width: 100%;
                    height: 2px;
                    background: #F2CF00;
                    position: absolute;
                    top: 0;
                    left: 0;
                    box-shadow: 0 0 20px rgba(254, 225, 28, 0.8);
                    z-index: 20;
                    animation: scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }

                @keyframes scan {
                    0% { top: 0%; }
                    50% { top: 100%; }
                    100% { top: 0%; }
                }
            `}</style>
        </div>
    );
}
