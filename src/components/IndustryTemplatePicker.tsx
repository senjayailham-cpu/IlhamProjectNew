import React, { useState } from 'react';
import { INDUSTRY_TEMPLATES } from '../types';
import { Hammer, Building2, Code2, FolderKanban, Sparkles, Check } from 'lucide-react';

interface IndustryTemplatePickerProps {
  onSelectTemplate: (templateKey: string) => Promise<void>;
}

export function IndustryTemplatePicker({ onSelectTemplate }: IndustryTemplatePickerProps) {
  const [selectedKey, setSelectedKey] = useState<string>('fabrication');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardItems = [
    {
      key: 'fabrication',
      title: 'Fabrication & Manufacturing',
      icon: Hammer,
      badge: 'Austin Batam Default',
      desc: 'Nesting, CNC, Bending, Machining stages with Welders, Fitters, Grinders, and QC Inspections.',
      color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30',
    },
    {
      key: 'construction',
      title: 'Construction & Building',
      icon: Building2,
      desc: 'Foundation, Structure, MEP, Finishing stages with Masons, Carpenters, Electricians, and Structural Checks.',
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    },
    {
      key: 'it',
      title: 'IT & Software Development',
      icon: Code2,
      desc: 'Design, Development, Testing, Deployment stages with Frontend, Backend, QA Engineers, and UAT Sign-offs.',
      color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
    },
    {
      key: 'general',
      title: 'General Project Management',
      icon: FolderKanban,
      desc: 'Planning, Execution, Review stages for versatile project teams and general operations.',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    },
  ];

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onSelectTemplate(selectedKey);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-base-bg flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-3xl w-full my-auto space-y-8 bg-base-surface border border-base-border p-8 rounded-3xl shadow-2xl">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-base-accent/10 border border-base-accent/20 rounded-full text-base-accent text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>Welcome to Organization Setup</span>
          </div>
          <h1 className="font-condensed font-extrabold text-3xl sm:text-4xl text-base-text uppercase tracking-wider">
            What kind of projects will you manage?
          </h1>
          <p className="text-sm text-base-muted max-w-xl mx-auto leading-relaxed">
            Choose an industry template to pre-fill processing stages, trade positions, inspection types, and terminology. You can customize everything later in Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cardItems.map(item => {
            const IconComponent = item.icon;
            const isSelected = selectedKey === item.key;
            return (
              <div
                key={item.key}
                onClick={() => setSelectedKey(item.key)}
                className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? 'border-base-accent bg-base-surface2/80 shadow-lg scale-[1.01]'
                    : 'border-base-border bg-base-surface/60 hover:bg-base-surface2/40 hover:border-base-border/80'
                }`}
              >
                {item.badge && (
                  <span className="absolute top-3 right-3 text-[9px] font-extrabold uppercase px-2 py-0.5 bg-base-accent/20 text-base-accent rounded-full border border-base-accent/30">
                    {item.badge}
                  </span>
                )}

                <div className="space-y-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br border ${item.color}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="font-condensed font-extrabold text-lg text-base-text uppercase tracking-wide">
                      {item.title}
                    </h3>
                    <p className="text-xs text-base-muted mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-base-border/30">
                  <span className="text-[10px] font-mono text-base-muted uppercase">
                    Template Key: {item.key}
                  </span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-base-accent border-base-accent text-white' : 'border-base-border'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-base-border">
          <p className="text-xs text-base-muted">
            Selected: <strong className="text-base-text uppercase font-bold">{selectedKey}</strong>
          </p>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3 bg-base-accent hover:bg-base-accent/90 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Configuring Organization...' : 'Continue to Dashboard →'}
          </button>
        </div>
      </div>
    </div>
  );
}
