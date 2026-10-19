// Round profile picture, or the person's initials when they haven't set one.
export default function Avatar({ user, size = 32 }) {
  const label = user.name || user.username;
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return user.avatar ? (
    <img className="avatar" src={user.avatar} alt="" style={style} />
  ) : (
    <span className="avatar initials" style={style} aria-hidden="true">
      {initials}
    </span>
  );
}
