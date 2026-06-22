# Login Page

## Frontend route

```txt
/login
Backend route needed
POST /api/auth/login/
Expected request
type LoginPayload = {
  username: string;
  password: string;
};
Expected response
type LoginResponse = {
  access: string;
  refresh: string;
};
Rule

ورود کاربران و هدایت به پنل مناسب باید بر اساس نقش کاربر انجام شود.
