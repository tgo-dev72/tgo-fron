import { ReactNode, Component, ErrorInfo } from "react";
import { useLocale } from "../i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface InnerProps extends Props {
  t: ReturnType<typeof useLocale>["t"];
}

class ErrorBoundaryClass extends Component<InnerProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    void error;
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    const { t, fallback } = this.props;

    if (this.state.hasError) {
      if (fallback) return fallback;
      return (
        <div className="sr-error-boundary" role="alert">
          <h2>{t("error.title")}</h2>
          <p>{t("error.desc")}</p>
          <button className="sr-btn sr-btn-primary" onClick={() => window.location.reload()}>
            {t("error.reload")}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children, fallback }: Props) {
  const { t } = useLocale();
  return <ErrorBoundaryClass t={t} fallback={fallback}>{children}</ErrorBoundaryClass>;
}
