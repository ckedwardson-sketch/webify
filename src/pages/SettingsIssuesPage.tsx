import { useEffect, useState } from "react";
import { fetchIssues, deleteIssue, IssueReport } from "../db/issues";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import "./Page.css";
import "./SettingsIssuesPage.css";

export function SettingsIssuesPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = async () => {
    setIssues(await fetchIssues());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    await deleteIssue(id);
    if (openId === id) setOpenId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Reported Issues" },
        ]}
      />
      <h1 className="page-title">Reported Issues</h1>

      {issues.length === 0 ? (
        <p className="page-text">Nothing saved yet — use "Report Issue" from the capture button.</p>
      ) : (
        <div className="issue-list">
          {issues.map((issue) => (
            <div key={issue.id} className="issue-row">
              <button className="issue-thumb" onClick={() => setOpenId(issue.id)}>
                <img src={issue.screenshotData} alt="" />
              </button>
              <div className="issue-info">
                <div className="issue-note">{issue.note}</div>
                <div className="issue-date">{issue.createdAt}</div>
              </div>
              <button className="add-button danger" onClick={() => handleDelete(issue.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {openId !== null && (
        <>
          <div className="issue-preview-backdrop" onClick={() => setOpenId(null)} />
          <div className="issue-preview">
            <img src={issues.find((i) => i.id === openId)?.screenshotData} alt="" />
            <button className="add-button secondary" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
