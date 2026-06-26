'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
    Brain,
    Zap,
    Check,
    X,
    Sparkles,
    ImageIcon,
    Search,
    Copy,
    Info,
    Code
} from 'lucide-react';
import { toast } from 'sonner';

// Scenario data
const scenarios = {
    bad: {
        alt: "",
        displayAlt: '""',
        fileName: "cat-on-sofa.jpg",
        srText: "Image. cat-on-sofa.jpg",
        googleKeywords: ["image", "jpg", "file", "unknown"],
        confidence: 15,
        explanation: "Without Alt Text, Google relies on the filename (which is often gibberish like IMG_294.jpg). Screen readers announce the filename, providing zero context to the user."
    },
    good: {
        alt: "Close up of a ginger cat sleeping comfortably on a teal velvet sofa.",
        displayAlt: '"Close up of a ginger cat sleeping comfortably on a teal velvet sofa."',
        fileName: "cat-on-sofa.jpg",
        srText: "Image. Close up of a ginger cat sleeping comfortably on a teal velvet sofa.",
        googleKeywords: ["cat", "ginger", "sleeping", "sofa", "teal", "velvet", "comfort"],
        confidence: 95,
        explanation: "With descriptive Alt Text, Google indexes specific keywords like 'Ginger Cat' and 'Velvet Sofa'. Screen reader users get a mental image of the scene."
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
            alert("Your device does not support text-to-speech.");
        }
    };

    return (
        <div className="min-h-screen bg-notebook-paper text-notebook-slate font-sans selection:bg-notebook-blue/10">
            <Navbar />

            {/* Header Section */}
            <header className="bg-white/40 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 shadow-sm md:static md:bg-transparent md:border-0 md:shadow-none md:pt-16 md:mb-12">
                <div className="max-w-6xl mx-auto px-6 py-6 md:py-0 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-notebook-blue/5 border border-notebook-blue/10 mb-4 transition-all duration-300">
                        <Sparkles className="h-3.5 w-3.5 text-notebook-blue" />
                        <span className="text-[10px] font-bold text-notebook-blue uppercase tracking-widest font-outfit">Interactive Lab</span>
                    </div>
                    <h1 className="text-3xl md:text-6xl font-bold text-notebook-slate leading-tight font-outfit tracking-tight">
                        Alt Text <span className="text-notebook-blue italic">Simulator.</span>
                    </h1>
                    <p className="text-sm md:text-xl text-slate-500 mt-4 max-w-2xl font-normal">See how clear descriptions improve search rankings and help everyone understand your images.</p>
                </div>
            </header>

            <main className="px-4 md:px-6 max-w-6xl mx-auto space-y-4 md:space-y-6 mt-4 md:mt-0 pb-12">

                {/* Controls Section */}
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-notebook border border-gray-100">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-10 justify-between items-center">

                        {/* Scenario Toggle */}
                        <div className="w-full md:w-auto">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block font-outfit">Choose a Version</span>
                            <div className="flex bg-notebook-surface p-1.5 rounded-2xl w-full md:w-auto border border-gray-100 shadow-inner">
                                <button
                                    onClick={() => handleScenarioChange('bad')}
                                    className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 font-outfit uppercase tracking-wider ${currentScenario === 'bad'
                                        ? 'bg-white shadow-notebook text-notebook-slate border border-gray-100'
                                        : 'text-slate-400 hover:text-notebook-blue'
                                        }`}
                                >
                                    <X className="h-4 w-4" />
                                    <span>No Alt Text</span>
                                </button>
                                <button
                                    onClick={() => handleScenarioChange('good')}
                                    className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 font-outfit uppercase tracking-wider ${currentScenario === 'good'
                                        ? 'bg-white shadow-notebook text-notebook-blue border border-gray-100'
                                        : 'text-slate-400 hover:text-notebook-blue'
                                        }`}
                                >
                                    <Check className="h-4 w-4" />
                                    <span>With Alt Text</span>
                                </button>
                            </div>
                        </div>

                        {/* Broken Image Toggle */}
                        <div className="w-full md:w-auto pt-6 md:pt-0 border-t md:border-t-0 border-gray-100">
                            <label className="flex items-center justify-between md:justify-start cursor-pointer group">
                                <span className="text-sm font-bold text-notebook-slate mr-4 font-outfit uppercase tracking-wider">Broken Image State</span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isBroken}
                                        onChange={toggleBrokenImage}
                                    />
                                    <div className="w-14 h-7 bg-notebook-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-notebook-blue peer-checked:after:bg-white shadow-inner"></div>
                                </div>
                            </label>
                        </div>

                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

                    {/* 1. The Browser View */}
                    <div className="bg-white rounded-[2.5rem] shadow-notebook border border-gray-100 overflow-hidden flex flex-col transition-all duration-500 hover:border-notebook-blue/20 group">
                        <div className="bg-notebook-surface px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-notebook-slate text-sm font-outfit uppercase tracking-widest flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-notebook-blue shadow-[0_0_10px_rgba(32,192,176,0.45)]"></div>
                                What Users See
                            </h2>
                            <span className="text-[10px] font-bold px-3 py-1 bg-white text-notebook-blue rounded-lg border border-gray-100 shadow-sm font-outfit tracking-widest uppercase">Visual</span>
                        </div>
                        <div className="p-10 flex-grow flex items-center justify-center bg-notebook-surface/10 min-h-[300px]">
                            <div className="relative w-full max-w-sm aspect-video bg-white shadow-notebook rounded-3xl overflow-hidden border border-gray-100 flex items-center justify-center p-2">
                                <img
                                    src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                                    className={`w-full h-full object-cover rounded-2xl transition-opacity duration-700 ${isBroken ? 'opacity-0' : 'opacity-100'}`}
                                    alt={data.alt}
                                />

                                {/* Broken Image State */}
                                {isBroken && (
                                    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                                        <ImageIcon className="h-10 w-10 text-slate-200 mb-4" />
                                        <p className="text-[10px] text-slate-300 mb-4 font-outfit font-bold uppercase tracking-widest">{data.fileName}</p>
                                        <div className="text-sm font-normal text-slate-500 border border-gray-100 p-5 rounded-2xl bg-notebook-surface w-full italic shadow-inner">
                                            {data.alt || data.fileName}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. The Code View */}
                    <div className="bg-white rounded-[2.5rem] shadow-notebook border border-gray-100 overflow-hidden flex flex-col transition-all duration-500 hover:border-notebook-blue/20">
                        <div className="bg-notebook-surface px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-notebook-slate text-sm font-outfit uppercase tracking-widest flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-notebook-slate shadow-[0_0_10px_rgba(15,23,42,0.5)]"></div>
                                Website Code (HTML)
                            </h2>
                            <span className="text-[10px] font-bold px-3 py-1 bg-white text-notebook-slate rounded-lg border border-gray-100 shadow-sm font-outfit tracking-widest uppercase">Code</span>
                        </div>
                        <div className="p-8 md:p-12 font-mono text-sm md:text-base relative flex-grow flex items-center overflow-x-auto bg-[#0F172A] selection:bg-notebook-blue/20">
                            <div className="text-slate-400 w-full whitespace-pre-wrap leading-relaxed">
                                <span className="text-blue-400 font-bold">&lt;img</span>{' '}
                                <span className="text-indigo-300">src</span>=<span className="text-emerald-400">&quot;cat-on-sofa.jpg&quot;</span>
                                {'\n  '}
                                <span className="text-indigo-300">alt</span>=<span className="text-white bg-white/5 rounded-lg transition-all duration-700 inline-block px-3 py-1.5 border border-white/10 shadow-lg">{data.displayAlt}</span>
                                <span className="text-blue-400 font-bold">&gt;</span>
                            </div>
                            <div className="absolute bottom-4 right-6 flex gap-1.5 opacity-30">
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Google Bot View */}
                    <div className="bg-white rounded-[2.5rem] shadow-notebook border border-gray-100 overflow-hidden flex flex-col transition-all duration-500 hover:border-notebook-blue/20">
                        <div className="bg-notebook-surface px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-notebook-slate text-sm font-outfit uppercase tracking-widest flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-notebook-blue shadow-[0_0_10px_rgba(32,192,176,0.45)]"></div>
                                Google's View
                            </h2>
                            <span className="text-[10px] font-bold px-3 py-1 bg-white text-notebook-blue rounded-lg border border-gray-100 shadow-sm font-outfit tracking-widest uppercase">SEO</span>
                        </div>
                        <div className="p-10 relative bg-notebook-surface/5">
                            {/* Scanning effect */}
                            {isScanning && (
                                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[2.5rem]">
                                    <div className="scan-line"></div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="w-16 h-16 bg-white rounded-[1.25rem] border border-gray-100 flex items-center justify-center flex-shrink-0 self-center md:self-start shadow-notebook">
                                    <div className="relative">
                                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-notebook-blue animate-pulse"></div>
                                        <Search className="w-7 h-7 text-notebook-slate" />
                                    </div>
                                </div>
                                <div className="flex-grow w-full">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 font-outfit">Keywords Found</h3>
                                    <div className="flex flex-wrap gap-2.5 mb-8">
                                        {data.googleKeywords.map((kw, index) => (
                                            <span
                                                key={index}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-bold font-outfit border transition-all duration-500 uppercase tracking-wider ${currentScenario === 'good'
                                                    ? 'bg-white text-notebook-blue border-notebook-blue/20'
                                                    : 'bg-white text-slate-400 border-gray-100'
                                                    }`}
                                            >
                                                {kw}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-notebook transition-all duration-500">
                                        <div className="flex justify-between text-[10px] mb-3 items-center font-bold uppercase tracking-widest font-outfit">
                                            <span className="text-slate-400">Understanding Level</span>
                                            <span className="text-notebook-slate bg-notebook-surface px-2.5 py-1 rounded-lg border border-gray-100">{data.confidence}%</span>
                                        </div>
                                        <div className="w-full bg-notebook-surface rounded-full h-2.5 p-0.5 border border-gray-100">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 shadow-sm ${data.confidence > 50 ? 'bg-notebook-blue' : 'bg-red-400'
                                                    }`}
                                                style={{ width: `${data.confidence}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Accessibility View */}
                    <div className="bg-white rounded-[2.5rem] shadow-notebook border border-gray-100 overflow-hidden flex flex-col transition-all duration-500 hover:border-notebook-blue/20">
                        <div className="bg-notebook-surface px-8 py-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-bold text-notebook-slate text-sm font-outfit uppercase tracking-widest flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-notebook-blue shadow-[0_0_10px_rgba(32,192,176,0.45)]"></div>
                                How Screen Readers Hear It
                            </h2>
                            <span className="text-[10px] font-bold px-3 py-1 bg-white text-notebook-blue rounded-lg border border-gray-100 shadow-sm font-outfit tracking-widest uppercase">Audio</span>
                        </div>
                        <div className="p-10 flex flex-col items-center justify-center text-center">

                            {/* Waveform */}
                            <div className={`h-12 flex items-center justify-center gap-2 mb-8 w-full transition-opacity duration-500 ${isSpeaking ? 'opacity-100' : 'opacity-20'}`}>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                    <div
                                        key={i}
                                        className={`bar ${isSpeaking ? 'speaking' : ''}`}
                                        style={{
                                            animationDelay: `-${1.2 - i * 0.15}s`,
                                            background: '#0D4F5E'
                                        }}
                                    ></div>
                                ))}
                            </div>

                            <div className="bg-notebook-slate text-notebook-surface font-outfit p-8 rounded-[2rem] w-full mb-8 text-left min-h-[120px] relative border border-gray-800 shadow-notebook group selection:bg-notebook-blue/40">
                                <div className="absolute top-4 right-4 flex gap-1.5 opacity-40">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                </div>
                                <span className="text-white/20 text-[10px] absolute bottom-4 right-6 font-bold tracking-[0.2em] uppercase">Rendered Output</span>
                                <span className="mr-3 text-notebook-blue font-bold tracking-widest uppercase text-[10px]">Assistant:</span>
                                <span className="leading-relaxed text-white text-lg font-normal italic">"{data.srText}"</span>
                            </div>

                            <button
                                onClick={speakAltText}
                                className="w-full py-5 bg-notebook-blue hover:bg-notebook-blue/90 active:scale-[0.98] text-white rounded-2xl font-bold font-outfit uppercase tracking-widest text-sm shadow-notebook transition-all flex items-center justify-center gap-4 group"
                            >
                                {isSpeaking ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                        <span>Reading...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                                        <span>Hear the Difference</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                </div>

                {/* Impact Analysis */}
                <div className="mt-8 p-10 bg-white border border-gray-100 rounded-[2.5rem] text-notebook-slate mb-12 shadow-notebook relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-notebook-blue/5 blur-[80px] rounded-full -mr-32 -mt-32 transition-colors"></div>
                    <h3 className="font-bold mb-6 flex items-center text-2xl text-notebook-slate gap-4 font-outfit">
                        <div className="p-3 bg-notebook-blue/5 rounded-2xl border border-notebook-blue/10">
                            <Info className="h-6 w-6 text-notebook-blue" />
                        </div>
                        Why It Matters
                    </h3>
                    <p className="text-lg leading-relaxed text-slate-500 max-w-4xl font-normal italic">
                        "{data.explanation}"
                    </p>
                </div>

                {/* INFOGRAPHIC SECTION */}
                <div className="mt-12 bg-white text-notebook-slate rounded-[3rem] overflow-hidden shadow-notebook border border-gray-100 mb-20 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-notebook-blue/10 to-transparent"></div>

                    <div className="p-10 md:p-16 text-center border-b border-gray-50">
                        <h2 className="text-3xl md:text-6xl font-black mb-6 text-notebook-slate tracking-tight font-outfit uppercase">How Alt Text Works</h2>
                        <p className="text-slate-500 text-sm md:text-xl max-w-2xl mx-auto font-normal">From website code to helping your users and SEO.</p>
                    </div>

                    <div className="p-8 md:p-16">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-12 md:gap-4 relative">

                            {/* Step 1 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center group">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-notebook-blue rounded-[2rem] flex items-center justify-center shadow-notebook-lg mb-8 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3">
                                    <Code className="h-10 w-10 text-white" />
                                </div>
                                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">01 Adding the Text</h3>
                                <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-[240px] font-normal">
                                    The <code className="bg-notebook-surface border border-gray-100 px-2 py-1 rounded-md text-notebook-blue font-bold font-mono text-[10px]">alt="description"</code> text is added directly to your image code.
                                </p>
                            </div>

                            {/* Arrow 1 */}
                            <div className="md:hidden">
                                <i className="fas fa-chevron-down text-slate-300 text-2xl animate-bounce"></i>
                            </div>
                            <div className="hidden md:block absolute left-[32%] top-16 w-[12%] h-[2px] bg-notebook-blue/10"></div>

                            {/* Step 2 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center group">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-notebook-slate rounded-[2rem] flex items-center justify-center shadow-notebook-lg mb-8 transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                                    <Search className="h-10 w-10 text-white" />
                                </div>
                                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">02 Search Engine Analysis</h3>
                                <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-[240px] font-normal">
                                    Google and other search engines read the description to understand what's in the image, helping you rank higher.
                                </p>
                            </div>

                            {/* Arrow 2 */}
                            <div className="md:hidden">
                                <i className="fas fa-chevron-down text-slate-300 text-2xl animate-bounce"></i>
                            </div>
                            <div className="hidden md:block absolute right-[32%] top-16 w-[12%] h-[2px] bg-notebook-blue/10"></div>

                            {/* Step 3 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center group">
                                <div className="w-28 h-28 bg-notebook-blue rounded-[2rem] flex items-center justify-center shadow-notebook-lg mb-8 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 relative">
                                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-[2rem]"></div>
                                    <Zap className="h-10 w-10 text-white relative z-10" />
                                </div>
                                <h3 className="text-sm font-bold text-notebook-slate mb-4 font-outfit uppercase tracking-widest">03 Better Experience</h3>
                                <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-[240px] font-normal">
                                    Users who can't see the image get a perfect description, while your site becomes more searchable for everyone.
                                </p>
                            </div>

                        </div>
                    </div>

                    <div className="bg-notebook-surface p-10 text-center text-[10px] text-slate-400 font-bold font-outfit uppercase tracking-[0.3em] border-t border-gray-50">
                        Smart descriptions make your website better for everyone—humans and search engines alike.
                    </div>
                </div>

            </main>

            <Footer />


            <style jsx>{`
                .bar {
                    width: 6px;
                    background: #0D4F5E;
                    margin: 0 3px;
                    border-radius: 999px;
                    animation: sound 0ms -800ms linear infinite alternate;
                    height: 10px;
                }

                .bar.speaking {
                    animation-duration: 400ms;
                }

                @keyframes sound {
                    0% { opacity: .35; height: 10px; }
                    100% { opacity: 1; height: 40px; }
                }
                
                .scan-line {
                    width: 100%;
                    height: 2px;
                    background: #0D4F5E;
                    position: absolute;
                    top: 0;
                    left: 0;
                    box-shadow: 0 0 20px #0D4F5E;
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
