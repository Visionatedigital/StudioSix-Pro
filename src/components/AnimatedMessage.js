/**
 * AnimatedMessage - Typewriter effect with sentence-by-sentence fade animation
 */

import React, { useState, useEffect } from 'react';

const AnimatedMessage = ({ sentences, onComplete = null, className = "" }) => {
  const [currentSentence, setCurrentSentence] = useState(0);
  const [visibleSentences, setVisibleSentences] = useState([]);

  useEffect(() => {
    if (!sentences || sentences.length === 0) return;

    const showNextSentence = () => {
      if (currentSentence < sentences.length) {
        const timer = setTimeout(() => {
          setVisibleSentences(prev => [...prev, sentences[currentSentence]]);
          setCurrentSentence(prev => prev + 1);
        }, currentSentence * 800); // 800ms delay between sentences

        return timer;
      } else if (onComplete) {
        // All sentences shown, call completion callback
        const completionTimer = setTimeout(onComplete, 500);
        return completionTimer;
      }
    };

    const timer = showNextSentence();
    return () => clearTimeout(timer);
  }, [currentSentence, sentences, onComplete]);

  // Reset when sentences change
  useEffect(() => {
    setCurrentSentence(0);
    setVisibleSentences([]);
  }, [sentences]);

  if (!sentences || sentences.length === 0) return null;

  return (
    <div className={`animated-message ${className}`}>
      {visibleSentences.map((sentence, index) => (
        <div
          key={index}
          className="sentence-fade-in"
          style={{
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.6s'
          }}
        >
          {sentence}
          {index < visibleSentences.length - 1 && ' '}
        </div>
      ))}
      
      <style>{`
        .animated-message {
          line-height: 1.5;
        }
        
        .sentence-fade-in {
          display: inline;
          opacity: 0;
          animation: fadeInFromLeft 0.6s ease-out forwards;
        }
        
        @keyframes fadeInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AnimatedMessage;