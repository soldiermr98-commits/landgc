<?php
/**
 * اعتبارسنجی سمت سرور فرم تماس گیلاکلیک برای Elementor Pro.
 * این فایل افزونه یا endpoint جدید نیست؛ پس از نصب در پوسته فرزند،
 * آن را از functions.php همان پوسته require کنید (راهنما در README).
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'elementor_pro/forms/validation', function ( $record, $handler ) {
    if ( 'gct_contact_form' !== $record->get_form_settings( 'form_id' ) ) {
        return;
    }

    $actions = $record->get_form_settings( 'submit_actions' );
    if ( ! is_array( $actions ) || ! in_array( 'email', $actions, true ) ) {
        $handler->add_error( 'message', 'سامانه ارسال فرم تنظیم نشده است. از راه‌های دیگر با ما تماس بگیرید.' );
        return;
    }

    $fields = $record->get( 'fields' );
    $fields = is_array( $fields ) ? $fields : array();
    $raw = static function ( $id ) use ( $fields ) {
        $value = $fields[ $id ]['raw_value'] ?? '';
        return is_string( $value ) ? trim( $value ) : '';
    };
    $length = static function ( $value ) {
        return function_exists( 'mb_strlen' ) ? mb_strlen( $value, 'UTF-8' ) : strlen( $value );
    };

    $name = $raw( 'name' );
    if ( '' === $name || $length( $name ) > 120 || '' === sanitize_text_field( $name ) ) {
        $handler->add_error( 'name', 'نام و نام خانوادگی معتبر وارد کنید.' );
    }

    // در مرورگر ارقام فارسی به لاتین تبدیل می‌شوند؛ سرور ورودی را نیز جداگانه بررسی می‌کند.
    $phone = $raw( 'phone' );
    $digits = preg_replace( '/\D/', '', $phone );
    if ( ! preg_match( '/^\+?[0-9().-]+$/D', $phone ) || strlen( $digits ) < 7 || strlen( $digits ) > 15 ) {
        $handler->add_error( 'phone', 'شماره تماس معتبر وارد کنید.' );
    }

    // raw_value مهم است: sanitize_email ممکن است ایمیل نامعتبر اختیاری را خالی کند.
    $email_value = $fields['email']['raw_value'] ?? '';
    $email = $raw( 'email' );
    if ( ! is_string( $email_value ) || ( '' !== $email && ( $length( $email ) > 254 || ! is_email( $email ) ) ) ) {
        $handler->add_error( 'email', 'نشانی ایمیل معتبر وارد کنید.' );
    }

    $allowed_subjects = array(
        'خرید و پشتیبانی محصولات نرم‌افزاری',
        'طراحی و توسعه وب‌سایت',
        'سئو و بهینه‌سازی',
        'برنامه‌نویسی اختصاصی',
        'همکاری و سایر موارد',
    );
    if ( ! in_array( $raw( 'subject' ), $allowed_subjects, true ) ) {
        $handler->add_error( 'subject', 'موضوع درخواست را از فهرست انتخاب کنید.' );
    }

    $message = $raw( 'message' );
    if ( '' === $message || $length( $message ) > 5000 || '' === sanitize_textarea_field( $message ) ) {
        $handler->add_error( 'message', 'جزئیات درخواست را وارد کنید (حداکثر ۵۰۰۰ نویسه).' );
    }
}, 10, 2 );
