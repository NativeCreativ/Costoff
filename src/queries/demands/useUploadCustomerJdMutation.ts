'use client';

import { useMutation } from '@tanstack/react-query';
import { uploadCustomerJdFile } from '@/services/demand.service';
import { useToast } from '@/components/ui/Toast';

/** Uploads a Customer JD file for the demand form. Nothing is cached: the form keeps the url. */
export function useUploadCustomerJdMutation() {
  const toast = useToast();
  return useMutation({
    mutationFn: (file: File) => uploadCustomerJdFile(file),
    onError: (err: any) => {
      console.error('Error uploading Customer JD:', err);
      toast.error('Upload Failed', err?.response?.data?.error || err?.message || 'Failed to upload the JD file');
    },
  });
}
