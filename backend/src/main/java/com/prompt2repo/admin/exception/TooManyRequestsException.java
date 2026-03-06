package com.prompt2repo.admin.exception;

public class TooManyRequestsException extends BusinessException {

    public TooManyRequestsException(String message) {
        super(429, message);
    }
}
