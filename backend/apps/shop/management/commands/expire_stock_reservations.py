"""Releases expired stock/seat reservations and cancels any order left
with no active reservation and no successful payment. This repo has no
Celery/task-queue infrastructure, so this command must be invoked by an
external cron/Task Scheduler entry in production -- it does nothing on
its own if nothing calls it."""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.shop.models import Order, PaymentTransaction, StockReservation
from apps.shop.services.order_service import transition_order_status

CANCELLABLE_STATUSES = (
    Order.Status.PENDING_PAYMENT,
    Order.Status.PAYMENT_PROCESSING,
    Order.Status.PAYMENT_FAILED,
)


class Command(BaseCommand):
    help = "Release expired shop stock/seat reservations and cancel abandoned unpaid orders."

    def handle(self, *args, **options):
        now = timezone.now()
        order_ids = list(
            StockReservation.objects.filter(status=StockReservation.Status.ACTIVE, expires_at__lt=now)
            .values_list("order_item__order_id", flat=True)
            .distinct()
        )

        released_count = 0
        cancelled_count = 0

        for order_id in order_ids:
            with transaction.atomic():
                order = Order.objects.select_for_update().get(pk=order_id)

                released_count += StockReservation.objects.filter(
                    order_item__order=order,
                    status=StockReservation.Status.ACTIVE,
                    expires_at__lt=now,
                ).update(status=StockReservation.Status.RELEASED)

                still_has_active_reservation = StockReservation.objects.filter(
                    order_item__order=order, status=StockReservation.Status.ACTIVE
                ).exists()
                has_successful_payment = PaymentTransaction.objects.filter(
                    attempt__order=order,
                    transaction_type=PaymentTransaction.TransactionType.VERIFICATION_SUCCEEDED,
                ).exists()

                if (
                    not still_has_active_reservation
                    and not has_successful_payment
                    and order.status in CANCELLABLE_STATUSES
                ):
                    transition_order_status(
                        order, Order.Status.CANCELLED, reason="رزرو موجودی منقضی شد و پرداختی ثبت نشد."
                    )
                    cancelled_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Released {released_count} reservation(s), cancelled {cancelled_count} order(s)."
            )
        )
