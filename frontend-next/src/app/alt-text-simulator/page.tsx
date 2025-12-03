'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

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
        <div className="min-h-screen bg-gray-100">
            <Navbar />

            {/* Mobile Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm md:static md:bg-transparent md:border-0 md:shadow-none md:mb-6">
                <div className="max-w-6xl mx-auto px-4 py-4 md:py-8 text-center md:text-left">
                    <h1 className="text-xl md:text-3xl font-bold text-gray-900 leading-tight">
                        <i className="fas fa-universal-access text-blue-600 mr-2"></i>Alt Text Simulator
                    </h1>
                    <p className="text-xs md:text-base text-gray-500 mt-1 hidden md:block">See how code changes the experience for bots and humans.</p>
                </div>
            </header>

            <main className="px-4 md:px-6 max-w-6xl mx-auto space-y-4 md:space-y-6 mt-4 md:mt-0 pb-12">

                {/* Controls Section */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-between items-center">

                        {/* Scenario Toggle */}
                        <div className="w-full md:w-auto">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block md:hidden">Select Scenario</span>
                            <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                                <button
                                    onClick={() => handleScenarioChange('bad')}
                                    className={`flex-1 md:flex-none px-4 py-3 md:py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${currentScenario === 'bad'
                                            ? 'bg-white shadow text-red-600 border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700 border border-transparent'
                                        }`}
                                >
                                    <i className="fas fa-times-circle"></i>
                                    <span>No Alt Text</span>
                                </button>
                                <button
                                    onClick={() => handleScenarioChange('good')}
                                    className={`flex-1 md:flex-none px-4 py-3 md:py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${currentScenario === 'good'
                                            ? 'bg-white shadow text-green-600 border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700 border border-transparent'
                                        }`}
                                >
                                    <i className="fas fa-check-circle"></i>
                                    <span>Optimized</span>
                                </button>
                            </div>
                        </div>

                        {/* Broken Image Toggle */}
                        <div className="w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                            <label className="flex items-center justify-between md:justify-start cursor-pointer w-full p-2 md:p-0 rounded hover:bg-gray-50 md:hover:bg-transparent transition-colors">
                                <span className="text-sm font-medium text-gray-700 mr-3">Simulate Broken Image</span>
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isBroken}
                                        onChange={toggleBrokenImage}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                                </div>
                            </label>
                        </div>

                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

                    {/* 1. The Browser View */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-700 text-sm md:text-base">
                                <i className="fas fa-desktop mr-2 text-blue-500"></i>Browser View
                            </h2>
                            <span className="text-[10px] uppercase font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded">Visual</span>
                        </div>
                        <div className="p-4 md:p-6 flex-grow flex items-center justify-center bg-gray-100 min-h-[250px] md:min-h-[300px]">
                            <div className="relative w-full max-w-md aspect-video bg-white shadow-lg rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center">
                                <img
                                    src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                                    className={`w-full h-full object-cover transition-opacity duration-300 ${isBroken ? 'opacity-0' : 'opacity-100'}`}
                                    alt={data.alt}
                                />

                                {/* Broken Image State */}
                                {isBroken && (
                                    <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                                        <i className="fas fa-image text-3xl text-gray-300 mb-3"></i>
                                        <p className="text-[10px] text-gray-400 mb-2 font-mono">img_29384.jpg</p>
                                        <div className="text-xs md:text-sm font-medium text-gray-800 border-2 border-dashed border-gray-300 p-3 rounded bg-white w-full shadow-sm">
                                            {data.alt || data.fileName}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. The Code View */}
                    <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md">
                        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-200 text-sm md:text-base">
                                <i className="fas fa-code mr-2 text-purple-400"></i>HTML Code
                            </h2>
                            <span className="text-[10px] uppercase font-bold px-2 py-1 bg-slate-700 text-gray-300 rounded">Source</span>
                        </div>
                        <div className="p-4 md:p-6 font-mono text-xs md:text-sm relative flex-grow flex items-center overflow-x-auto">
                            <div className="text-green-400 w-full whitespace-pre-wrap leading-relaxed">
                                <span className="text-pink-400">&lt;img</span>{' '}
                                <span className="text-purple-400">src</span>=<span className="text-yellow-300">&quot;cat-on-sofa.jpg&quot;</span>
                                {'\n  '}
                                <span className="text-purple-400">alt</span>=<span className="text-yellow-300 bg-slate-800 rounded transition-all duration-300 inline-block p-1">{data.displayAlt}</span>
                                <span className="text-pink-400">&gt;</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Google Bot View */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-700 text-sm md:text-base">
                                <i className="fab fa-google mr-2 text-green-600"></i>Google Bot
                            </h2>
                            <span className="text-[10px] uppercase font-bold px-2 py-1 bg-green-100 text-green-700 rounded">SEO</span>
                        </div>
                        <div className="p-4 md:p-6 relative">
                            {/* Scanning effect */}
                            {isScanning && (
                                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-xl">
                                    <div className="scan-line"></div>
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-4 items-start">
                                <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 self-center md:self-start">
                                    <i className="fas fa-robot text-xl md:text-2xl text-blue-500"></i>
                                </div>
                                <div className="flex-grow w-full">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Detected Keywords:</h3>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {data.googleKeywords.map((kw, index) => (
                                            <span
                                                key={index}
                                                className={`px-2 py-1 rounded text-[10px] md:text-xs font-mono font-semibold ${currentScenario === 'good'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-200 text-gray-600'
                                                    }`}
                                            >
                                                {kw}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Context Confidence</span>
                                            <span className="font-bold text-gray-900">{data.confidence}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 md:h-2">
                                            <div
                                                className={`h-1.5 md:h-2 rounded-full transition-all duration-500 ${data.confidence > 50 ? 'bg-green-500' : 'bg-red-400'
                                                    }`}
                                                style={{ width: `${data.confidence}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Screen Reader View */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-700 text-sm md:text-base">
                                <i className="fas fa-assistive-listening-systems mr-2 text-indigo-500"></i>Screen Reader
                            </h2>
                            <span className="text-[10px] uppercase font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded">Audio</span>
                        </div>
                        <div className="p-4 md:p-6 flex flex-col items-center justify-center text-center">

                            {/* Waveform */}
                            <div className={`h-8 md:h-10 flex items-center justify-center gap-1 mb-4 md:mb-6 w-full transition-opacity duration-300 ${isSpeaking ? 'opacity-100' : 'opacity-30'}`}>
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className={`bar ${isSpeaking ? 'speaking' : ''}`}
                                        style={{ animationDelay: `-${1.2 - i * 0.2}s` }}
                                    ></div>
                                ))}
                            </div>

                            <div className="bg-gray-900 text-green-400 font-mono p-3 md:p-4 rounded-lg w-full mb-4 md:mb-6 text-left min-h-[60px] md:min-h-[80px] text-xs md:text-sm relative border border-gray-700 shadow-inner">
                                <span className="text-gray-500 text-[10px] absolute top-2 right-2">VoiceOver</span>
                                <span className="mr-2 text-blue-400 font-bold">System:</span>
                                <span>{data.srText}</span>
                            </div>

                            <button
                                onClick={speakAltText}
                                className="w-full py-3 md:py-3 bg-indigo-600 active:bg-indigo-800 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-colors flex items-center justify-center gap-2 touch-manipulation"
                            >
                                <i className="fas fa-play"></i> Hear Audio
                            </button>
                        </div>
                    </div>

                </div>

                {/* Explanation Area */}
                <div className="mt-6 md:mt-8 p-4 md:p-6 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 mb-8">
                    <h3 className="font-bold mb-2 flex items-center text-sm md:text-base">
                        <i className="fas fa-info-circle mr-2"></i>Analysis
                    </h3>
                    <p className="text-xs md:text-sm leading-relaxed text-blue-800">
                        {data.explanation}
                    </p>
                </div>

                {/* INFOGRAPHIC SECTION */}
                <div className="mt-12 bg-slate-800 text-white rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 md:p-8 text-center border-b border-slate-700">
                        <h2 className="text-2xl md:text-3xl font-bold mb-2 text-white">How Alt Text Travels</h2>
                        <p className="text-slate-400 text-sm md:text-base">The invisible journey of a single line of code.</p>
                    </div>

                    <div className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">

                            {/* Step 1 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-3">
                                    <i className="fas fa-code text-2xl md:text-3xl text-white"></i>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">1. The Input</h3>
                                <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-[200px]">
                                    Developer adds the <code className="bg-slate-700 px-1 py-0.5 rounded text-yellow-300">alt=&quot;&quot;</code> tag to the image code. This is the source of truth.
                                </p>
                            </div>

                            {/* Arrow 1 */}
                            <div className="md:hidden">
                                <i className="fas fa-arrow-down text-slate-600 text-xl"></i>
                            </div>
                            <div className="hidden md:block absolute left-[30%] top-10 w-[15%] border-t-2 border-dashed border-slate-600"></div>

                            {/* Step 2 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 transform -rotate-2">
                                    <i className="fas fa-cogs text-2xl md:text-3xl text-white"></i>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">2. Processing</h3>
                                <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-[200px]">
                                    Browsers load the page. If the image breaks, they prepare the text. Search bots scan for context.
                                </p>
                            </div>

                            {/* Arrow 2 */}
                            <div className="md:hidden">
                                <i className="fas fa-arrow-down text-slate-600 text-xl"></i>
                            </div>
                            <div className="hidden md:block absolute right-[30%] top-10 w-[15%] border-t-2 border-dashed border-slate-600"></div>

                            {/* Step 3 */}
                            <div className="relative z-10 w-full md:w-1/3 flex flex-col items-center text-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 transform rotate-3">
                                    <i className="fas fa-headphones text-2xl md:text-3xl text-white"></i>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">3. The Output</h3>
                                <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-[200px]">
                                    Screen readers convert text to speech. Search engines rank the image for keywords.
                                </p>
                            </div>

                        </div>
                    </div>

                    <div className="bg-slate-900 p-4 text-center text-xs text-slate-500">
                        <i className="fas fa-universal-access mr-1"></i> Making the web accessible benefits everyone.
                    </div>
                </div>

            </main>

            <Footer />

            <style jsx>{`
                .bar {
                    width: 6px;
                    background: #3b82f6;
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
                    background: #10b981;
                    position: absolute;
                    top: 0;
                    left: 0;
                    box-shadow: 0 0 15px #10b981;
                    z-index: 20;
                    animation: scan 2s ease-in-out infinite;
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
