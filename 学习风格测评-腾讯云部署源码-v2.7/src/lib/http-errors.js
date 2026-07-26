export class ApiError extends Error {
  constructor(message, { status, publicMessage }) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export class ValidationError extends ApiError {
  constructor(message) {
    super(message, { status: 400, publicMessage: "请求数据无效" });
  }
}

export class NotFoundError extends ApiError {
  constructor(message) {
    super(message, { status: 404, publicMessage: "资源不存在" });
  }
}

export class ConflictError extends ApiError {
  constructor(message) {
    super(message, { status: 409, publicMessage: "请求状态冲突" });
  }
}
