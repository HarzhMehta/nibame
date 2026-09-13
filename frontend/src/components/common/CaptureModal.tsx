import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useBrain } from '@/context/BrainContext';
import { ItemType } from '@/types';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { detectItemType } from '@/lib/utils';

export const CaptureModal: React.FC = () => {
  const { isCaptureModalOpen, closeCaptureModal, captureItem } = useBrain();

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [selectedType, setSelectedType] = useState<ItemType | 'auto'>('auto');
  const [tagsInput, setTagsInput] = useState('');

  const [titleError, setTitleError] = useState<string | undefined>();
  const [contentError, setContentError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setContent('');
    setSelectedType('auto');
    setTagsInput('');
    setTitleError(undefined);
    setContentError(undefined);
    setIsSubmitting(false);
    setIsSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    closeCaptureModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    if (!title.trim()) {
      setTitleError('Title is required');
      hasError = true;
    } else {
      setTitleError(undefined);
    }

    if (!url.trim() && !content.trim()) {
      setContentError('Please provide a URL or some note content');
      hasError = true;
    } else {
      setContentError(undefined);
    }

    if (hasError) return;

    setIsSubmitting(true);

    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const resolvedType =
        selectedType === 'auto'
          ? url.trim()
            ? detectItemType(url)
            : 'note'
          : selectedType;

      await captureItem({
        title: title.trim(),
        url: url.trim() || undefined,
        content: content.trim() || undefined,
        type: resolvedType,
        tags: parsedTags,
      });

      setIsSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 750);
    } catch {
      setContentError('Failed to capture item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isCaptureModalOpen}
      onClose={handleClose}
      title="Capture to Brain"
      description="Save a link, article, or thought. nibame will connect it later."
    >
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-95">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-stone-900">Captured to Inbox</h3>
          <p className="text-xs text-stone-500 mt-1">
            Your item has been captured and queued for memory extraction.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <Input
            label="Title"
            placeholder="e.g. Distributed Consensus in Raft"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(undefined);
            }}
            error={titleError}
            autoFocus
          />

          {/* URL */}
          <Input
            label="URL (Optional)"
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (contentError) setContentError(undefined);
            }}
          />

          {/* Note/Content */}
          <Textarea
            label="Note / Summary"
            placeholder="Key takeaways, thoughts, or details..."
            rows={3}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (contentError) setContentError(undefined);
            }}
            error={contentError}
          />

          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700 select-none">
              Type
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 text-xs">
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'url', label: 'Link' },
                  { id: 'note', label: 'Note' },
                  { id: 'article', label: 'Article' },
                  { id: 'video', label: 'Video' },
                  { id: 'github_repo', label: 'Repo' },
                ] as const
              ).map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selectedType === t.id
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <Input
            label="Tags (comma-separated)"
            placeholder="kafka, distributed-systems, reading"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Capture to Brain
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
