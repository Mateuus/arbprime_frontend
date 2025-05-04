// hooks/useModalManager.ts
import { useRouter } from "next/router";

export function useModalManager(modalId: string) {
  const router = useRouter();
  const query = router.query;

  const isOpen = query.modal === modalId;
  const page = typeof query.page === 'string' ? query.page : null;

  const closeModal = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { modal, page, ...rest } = query;
    router.replace({ pathname: router.pathname, query: { ...rest } }, undefined, { shallow: true });
  };

  const openModal = (page?: string) => {
    router.replace(
      {
        pathname: router.pathname,
        query: { ...query, modal: modalId, ...(page && { page }) },
      },
      undefined,
      { shallow: true }
    );
  };

  return { isOpen, page, openModal, closeModal };
}