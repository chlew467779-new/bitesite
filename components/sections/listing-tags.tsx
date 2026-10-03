/**
 * Facilities ("Good to know") and occasions ("Great for") on the public restaurant page
 * (issue #4). The Owner chooses them in the dashboard; they show at once. Each layout passes the
 * classes of its own payment-methods block so the chips match the layout.
 */

type Props = {
  amenities?: string[] | null;
  occasion?: string[] | null;
  wrapperClass: string;
  labelClass: string;
  chipClass: string;
};

export function ListingTags({ amenities, occasion, wrapperClass, labelClass, chipClass }: Props) {
  const groups = [
    { label: "Good to know", tags: amenities ?? [] },
    { label: "Great for", tags: occasion ?? [] },
  ].filter((group) => group.tags.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className={wrapperClass}>
      {groups.map((group, index) => (
        <div key={group.label} className={index > 0 ? "mt-4" : undefined}>
          <p className={labelClass}>{group.label}</p>
          <ul className="flex flex-wrap gap-2" aria-label={group.label}>
            {group.tags.map((tag) => (
              <li key={tag} className={chipClass}>{tag}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
