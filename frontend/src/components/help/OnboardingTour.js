import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';

const OnboardingTour = ({ theme, userRole, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tourSteps, setTourSteps] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  // Load tour steps based on user role
  useEffect(() => {
    fetch('/docs/documentation-index.json')
      .then(res => res.json())
      .then(data => {
        const steps = data.onboarding[userRole] || data.onboarding['admin'] || [];
        setTourSteps(steps);
        if (steps.length > 0) {
          // Check if user has completed onboarding
          const hasCompletedOnboarding = localStorage.getItem(`onboarding-${userRole}-completed`);
          if (!hasCompletedOnboarding) {
            setTimeout(() => setIsVisible(true), 1000); // Delay to let page load
          }
        }
      })
      .catch(err => console.error('Failed to load onboarding tour:', err));
  }, [userRole]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(`onboarding-${userRole}-completed`, 'true');
    setIsVisible(false);
    if (onComplete) onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    if (onSkip) onSkip();
  };

  if (!isVisible || tourSteps.length === 0) return null;

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  // Get target element position
  const getTargetPosition = () => {
    // This would normally get the actual DOM element position
    // For simplicity, returning center position
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    };
  };

  const position = step.placement === 'center' ? getTargetPosition() : {};

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" />

      {/* Spotlight effect (optional) */}
      {step.target !== 'dashboard' && (
        <div
          className="fixed z-51"
          style={{
            // This would highlight the target element
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)'
          }}
        />
      )}

      {/* Tour Card */}
      <div
        className={`fixed z-52 max-w-md ${
          theme === 'dark' ? 'bg-slate-900' : 'bg-white'
        } rounded-xl shadow-2xl border ${
          theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
        }`}
        style={position}
      >
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded-t-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{currentStep + 1}</span>
                </div>
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                }`}>
                  Step {currentStep + 1} of {tourSteps.length}
                </span>
              </div>
              <h3 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {step.title}
              </h3>
            </div>
            <button
              onClick={handleSkip}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
              }`}
            >
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className={`text-base leading-relaxed ${
            theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
          }`}>
            {step.content}
          </p>

          {/* Additional Tips */}
          {step.tips && (
            <div className={`mt-4 p-4 rounded-lg ${
              theme === 'dark' ? 'bg-slate-800' : 'bg-blue-50'
            }`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                <span className="font-semibold">💡 Tip:</span> {step.tips}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleSkip}
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-600 hover:text-gray-700'
              }`}
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    theme === 'dark'
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              <button
                onClick={handleNext}
                className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {currentStep === tourSteps.length - 1 ? (
                  <>
                    <Check className="w-4 h-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-1 pb-4 px-6">
          {tourSteps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-blue-500'
                  : index < currentStep
                  ? 'w-1.5 bg-blue-500/50'
                  : 'w-1.5 bg-gray-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;
